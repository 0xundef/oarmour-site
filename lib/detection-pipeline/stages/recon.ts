import "server-only"

import fs from "fs"
import { logError, logInfo } from "@/lib/app-logger"
import { runStageAgent } from "../agent"
import { createOarmourMcpServer } from "../tools"
import { formatEvidenceForPrompt } from "../evidence"
import { getPipelineStagePath } from "../storage"
import { ReconOutputSchema, type ReconOutput, type SignalClass } from "../schemas"
import { buildStageSystemPrompt, type StageContext } from "./context"

/**
 * Deterministic fallback: one partition per candidate domain (or one per top-level
 * source file group if no domains). Guarantees the coverage invariant when the LLM
 * fails to commit a valid recon output.
 */
function fallbackRecon(ctx: StageContext): ReconOutput {
  const evidence = ctx.evidence
  const domains = evidence.candidateDomains && evidence.candidateDomains.length > 0
    ? evidence.candidateDomains
    : []
  if (domains.length > 0) {
    return {
      partitions: domains.map((d, i) => ({
        id: `p${i + 1}`,
        label: `domain ${d}`,
        targetFiles: evidence.fileTree.slice(0, 10).map((f) => f.path),
        candidateSignalClasses: ["dataflow", "supply-chain"] as SignalClass[],
        candidateDomains: [d],
        rationale: `fallback: domain-cluster partition for ${d}`,
      })),
      droppedClusters: [],
      manifestRiskPreview: JSON.stringify(evidence.manifestSummary).slice(0, 500),
      trustBoundaries: [],
    }
  }
  // General mode fallback: split file tree into ~3 balanced partitions by component guess.
  const files = evidence.fileTree.map((f) => f.path)
  const groups: Record<string, string[]> = { background: [], content: [], other: [] }
  for (const f of files) {
    if (/background|service.?worker/i.test(f)) groups.background.push(f)
    else if (/content/i.test(f)) groups.content.push(f)
    else groups.other.push(f)
  }
  const partitions = Object.entries(groups)
    .filter(([, fs]) => fs.length > 0)
    .map(([k, fs], i) => ({
      id: `p${i + 1}`,
      label: `${k} files`,
      component: k,
      targetFiles: fs.slice(0, 30),
      candidateSignalClasses: ["dataflow", "remote-code", "messaging", "dom-injection", "privacy", "permissions", "supply-chain"] as SignalClass[],
      rationale: `fallback: ${k} component partition`,
    }))
  return {
    partitions: partitions.length > 0 ? partitions : [{
      id: "p1",
      label: "all files",
      targetFiles: files.slice(0, 30),
      candidateSignalClasses: ["dataflow", "remote-code", "permissions", "supply-chain"] as SignalClass[],
      rationale: "fallback: single partition",
    }],
    droppedClusters: [],
    manifestRiskPreview: JSON.stringify(evidence.manifestSummary).slice(0, 500),
    trustBoundaries: [],
  }
}

export async function runRecon(ctx: StageContext): Promise<ReconOutput> {
  const mcpServer = createOarmourMcpServer({
    storeId: ctx.storeId,
    version: ctx.version,
    runId: ctx.runId,
    runDir: ctx.runDir,
  })

  const prompt = [
    "# Task",
    "Produce a partition of this extension's attack surface for parallel find agents.",
    "Read the manifest; map trust boundaries; propose balanced, non-empty partitions",
    "tagged with candidate signal classes. Coverage invariant: every candidate domain",
    "and every declared component must appear in a partition or droppedClusters.",
    "",
    formatEvidenceForPrompt(ctx.evidence),
  ].join("\n")

  const result = await runStageAgent({
    stage: "recon",
    systemPrompt: buildStageSystemPrompt("recon", ctx),
    prompt,
    mcpServer,
    runDir: ctx.runDir,
    modelId: ctx.modelId,
  })

  const reconPath = getPipelineStagePath(ctx.runDir, "recon")
  if (!result.ok || !fs.existsSync(reconPath)) {
    logError("[detection-pipeline] recon failed or did not commit; using fallback", {
      stage: "recon",
      ok: result.ok,
      error: result.error,
    })
    const fb = fallbackRecon(ctx)
    fs.writeFileSync(reconPath, JSON.stringify(fb, null, 2), "utf-8")
    return fb
  }

  const raw = JSON.parse(fs.readFileSync(reconPath, "utf8"))
  const parsed = ReconOutputSchema.safeParse(raw)
  if (!parsed.success) {
    logError("[detection-pipeline] recon output failed schema; using fallback", { error: parsed.error.message })
    const fb = fallbackRecon(ctx)
    fs.writeFileSync(reconPath, JSON.stringify(fb, null, 2), "utf-8")
    return fb
  }
  logInfo("[detection-pipeline] recon done", {
    partitions: parsed.data.partitions.length,
    dropped: parsed.data.droppedClusters.length,
    turns: result.numTurns,
  })
  return parsed.data
}
