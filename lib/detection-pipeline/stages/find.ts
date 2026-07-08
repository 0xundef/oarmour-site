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
  MergedFindingsFileSchema,
  type Finding,
  type MergedFindingsFile,
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
    `Audit partition \`${partition.id}\` (${partition.label}) against the 7-class threat model.`,
    "Grep for anchors, Read context, trace source→sink taint. Emit evidence-backed findings",
    "OR commit an empty findings array if the partition is clean. Your final action MUST be",
    "`mcp__oarmour__commit_stage_output` with stage=\"findings\".",
    "",
    `## Partition ${partition.id}`,
    `- targetFiles: ${JSON.stringify(partition.targetFiles)}`,
    `- candidateSignalClasses: ${JSON.stringify(partition.candidateSignalClasses)}`,
    partition.candidateDomains ? `- candidateDomains: ${JSON.stringify(partition.candidateDomains)}` : "",
    `- sourceFidelity: ${evidence.fileTree.some((f) => /\.min\.|bundle/i.test(f.path)) ? "raw" : "raw"} (v1: no preprocessing; high-severity findings → needsManualConfirmation)`,
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

async function runFindAgentForPartition(ctx: StageContext, partition: Partition): Promise<Finding[]> {
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
    return []
  }
  try {
    const raw = JSON.parse(fs.readFileSync(partPath, "utf8"))
    const findings = Array.isArray(raw.findings) ? raw.findings : []
    // Validate each finding.
    return findings
      .map((f: unknown) => FindingSchema.safeParse(f))
      .filter((r: { success: boolean }) => r.success)
      .map((r: { success: boolean; data: Finding }) => r.data)
  } catch (err) {
    logError("[detection-pipeline] find partition parse failed", {
      partitionId: partition.id,
      error: err instanceof Error ? err.message : String(err),
    })
    return []
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

  const allFindings: Finding[] = perPartition.flat()

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

  const merged: MergedFindingsFile = {
    partitionsProcessed: partitions.map((p) => p.id),
    sourceFidelity,
    findings: deduped,
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
  })

  // Clean up per-partition files after merge (keep the merged file canonical).
  for (const p of listFindingsPartitionPaths(ctx.runDir)) {
    try { fs.unlinkSync(p) } catch { /* keep */ }
  }

  return merged
}
