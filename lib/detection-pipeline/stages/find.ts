import "server-only"

import fs from "fs"
import { logError, logInfo } from "@/lib/app-logger"
import { runStageAgent } from "../agent"
import { createOarmourMcpServer } from "../tools"
import { formatEvidenceForPrompt } from "../evidence"
import {
  getFindingsPartitionPath,
  getPipelineStagePath,
  listFindingsPartitionPaths,
} from "../storage"
import { mapWithConcurrencyLimit } from "../concurrency"
import {
  FindingSchema,
  FindingsCoverageSchema,
  MergedFindingsFileSchema,
  type Finding,
  type FindingsCoverage,
  type MergedFindingsFile,
  type MergedCoverage,
  type Partition,
  type ReconOutput,
  type SourceFidelity,
} from "../schemas"
import { buildStageSystemPrompt, type StageContext } from "./context"

function findConcurrency(): number {
  const n = Number.parseInt(process.env.DETECTION_FIND_CONCURRENCY ?? "", 10)
  return Number.isFinite(n) && n > 0 ? n : 3
}

function buildPartitionPrompt(ctx: StageContext, partition: Partition): string {
  const evidence = ctx.evidence
  const parts = [
    "# Task",
    `Audit partition \`${partition.id}\` (${partition.label}) against the threat model`,
    "(the generic chrome-ext-audit classes; PLUS the wallet-ext-audit classes if this is a",
    "wallet/web3 extension). Grep for anchors, Read context, trace source→sink taint. Emit",
    "evidence-backed findings OR commit an empty findings array if the partition is clean.",
    "Your final action MUST be `mcp__oarmour__commit_stage_output` with stage=\"findings\".",
    "",
    "## Coverage attestation (REQUIRED)",
    "Your payload MUST include a `coverage` object declaring what you actually inspected, so a",
    "\"clean\" partition is never silently trusted:",
    "- `inspectedFiles`: every targetFile you grepped/read.",
    "- `skippedFiles`: targetFiles you did NOT inspect (ran out of budget).",
    "- `classesApplied`: the signal classes you actively checked.",
    "- `complete`: true ONLY if you audited every targetFile for every relevant class.",
    "If you could not finish, commit what you have with complete=false and the un-audited",
    "files in skippedFiles. Do NOT assert \"clean\" for files you did not inspect.",
    "",
    `## Partition ${partition.id}`,
    `- targetFiles: ${JSON.stringify(partition.targetFiles)}`,
    `- candidateSignalClasses: ${JSON.stringify(partition.candidateSignalClasses)}`,
    partition.candidateDomains ? `- candidateDomains: ${JSON.stringify(partition.candidateDomains)}` : "",
    `- sourceFidelity: raw (v1: no preprocessing; high-severity findings → needsManualConfirmation)`,
    ctx.runId ? `- ai_testing runId for runtime confirmation: ${ctx.runId}` : "",
    "",
    "## Extension context",
    `- storeId: ${evidence.storeId}`,
    `- version: ${evidence.version}`,
    `- unpack root (absolute; use with Read/Glob/Grep): ${evidence.unpackRoot}`,
    "",
    "## manifest summary",
    "```json",
    JSON.stringify(evidence.manifestSummary, null, 2),
    "```",
    "",
  ]
  if (evidence.apexDomains.length > 0) {
    parts.push("## apex domains + enrichment (relevant to this partition)", "```json")
    const relevant = partition.candidateDomains && partition.candidateDomains.length > 0
      ? evidence.apexDomains.filter((d) => partition.candidateDomains!.includes(String(d.apexDomain)))
      : evidence.apexDomains
    parts.push(JSON.stringify(relevant, null, 2), "```", "")
  }
  if (evidence.runtimeDomains && evidence.runtimeDomains.length > 0) {
    parts.push("## runtime / novel domains", "```json", JSON.stringify(evidence.runtimeDomains, null, 2), "```", "")
  }
  parts.push("## domain provenance", "```json", JSON.stringify(evidence.domainProvenance, null, 2).slice(0, 12000), "```")
  return parts.filter((l) => l !== "").join("\n")
}

interface PartitionResult {
  findings: Finding[]
  coverage: FindingsCoverage | null
  committed: boolean
}

async function runFindAgentForPartition(ctx: StageContext, partition: Partition): Promise<PartitionResult> {
  const mcpServer = createOarmourMcpServer({
    storeId: ctx.storeId,
    version: ctx.version,
    runId: ctx.runId,
    runDir: ctx.runDir,
  })
  const result = await runStageAgent({
    stage: "find",
    systemPrompt: buildStageSystemPrompt("find", ctx),
    prompt: buildPartitionPrompt(ctx, partition),
    mcpServer,
    runDir: ctx.runDir,
    modelId: ctx.modelId,
  })
  const partPath = getFindingsPartitionPath(ctx.runDir, partition.id)
  if (!result.ok || !fs.existsSync(partPath)) {
    logError("[detection-pipeline] find partition did not commit", {
      partitionId: partition.id,
      ok: result.ok,
      error: result.error,
    })
    return { findings: [], coverage: null, committed: false }
  }
  try {
    const raw = JSON.parse(fs.readFileSync(partPath, "utf8"))
    const rawFindings = Array.isArray(raw.findings) ? raw.findings : []
    const findings = rawFindings
      .map((f: unknown) => FindingSchema.safeParse(f))
      .filter((r: { success: boolean }) => r.success)
      .map((r: { success: boolean; data: Finding }) => r.data)
    const coverageParse = FindingsCoverageSchema.safeParse(raw.coverage)
    return {
      findings,
      coverage: coverageParse.success ? coverageParse.data : null,
      committed: true,
    }
  } catch (err) {
    logError("[detection-pipeline] find partition parse failed", {
      partitionId: partition.id,
      error: err instanceof Error ? err.message : String(err),
    })
    return { findings: [], coverage: null, committed: true }
  }
}

export async function runFind(ctx: StageContext, recon: ReconOutput): Promise<MergedFindingsFile> {
  const partitions = recon.partitions
  logInfo("[detection-pipeline] find starting", { partitions: partitions.length, concurrency: findConcurrency() })

  const perPartition = await mapWithConcurrencyLimit(
    partitions,
    findConcurrency(),
    (p) => runFindAgentForPartition(ctx, p),
  )

  const allFindings: Finding[] = perPartition.flatMap((r) => r.findings)

  // Deduplicate within the run by findingId (same anchor from two partitions).
  const seen = new Set<string>()
  const deduped: Finding[] = []
  for (const f of allFindings) {
    if (seen.has(f.findingId)) continue
    seen.add(f.findingId)
    deduped.push(f)
  }

  // sourceFidelity: mode across findings (default raw).
  const fidelityCounts = new Map<string, number>()
  for (const f of deduped) fidelityCounts.set(f.sourceFidelity, (fidelityCounts.get(f.sourceFidelity) ?? 0) + 1)
  let sourceFidelity: SourceFidelity = "raw"
  let max = 0
  for (const [k, v] of fidelityCounts) {
    if (v > max) { max = v; sourceFidelity = k as SourceFidelity }
  }

  // Aggregate per-partition coverage → audit-completeness signal for the report.
  const coverage: MergedCoverage = aggregateCoverage(partitions, perPartition)

  const merged: MergedFindingsFile = {
    partitionsProcessed: partitions.map((p) => p.id),
    sourceFidelity,
    findings: deduped,
    coverage,
  }

  const outPath = getPipelineStagePath(ctx.runDir, "findings")
  fs.writeFileSync(outPath, JSON.stringify(merged, null, 2), "utf-8")

  // Validate.
  const parsed = MergedFindingsFileSchema.safeParse(merged)
  if (!parsed.success) {
    logError("[detection-pipeline] merged findings failed schema", { error: parsed.error.message })
  }

  logInfo("[detection-pipeline] find done", {
    partitions: partitions.length,
    findings: deduped.length,
    fidelity: sourceFidelity,
    audited: coverage.auditedPartitions,
    incomplete: coverage.incompletePartitions,
    missingCoverage: coverage.missingCoveragePartitions.length,
  })

  // Clean up per-partition files after merge (keep the merged file canonical).
  for (const p of listFindingsPartitionPaths(ctx.runDir)) {
    try { fs.unlinkSync(p) } catch { /* keep */ }
  }

  return merged
}

/**
 * Roll up per-partition coverage into a run-wide audit-completeness summary.
 * A partition is "audited" only if it committed a coverage attestation marked
 * complete. Partitions that didn't commit, or committed incomplete coverage,
 * are surfaced so the report can flag their "clean" results as UNVERIFIED.
 */
function aggregateCoverage(
  partitions: Partition[],
  results: PartitionResult[],
): MergedCoverage {
  const byId = new Map(results.map((r, i) => [partitions[i]?.id ?? `__${i}`, r]))
  let audited = 0
  let incomplete = 0
  const missing: string[] = []
  let inspected = 0
  let skipped = 0
  for (const p of partitions) {
    const r = byId.get(p.id)
    if (!r || !r.committed || !r.coverage) {
      missing.push(p.id)
      incomplete += 1
      continue
    }
    inspected += r.coverage.inspectedFiles.length
    skipped += r.coverage.skippedFiles.length
    if (r.coverage.complete) audited += 1
    else incomplete += 1
  }
  return {
    totalPartitions: partitions.length,
    auditedPartitions: audited,
    incompletePartitions: incomplete,
    missingCoveragePartitions: missing,
    inspectedFileCount: inspected,
    skippedFileCount: skipped,
  }
}
