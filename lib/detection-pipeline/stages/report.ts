import "server-only"

import fs from "fs"
import { logError, logInfo } from "@/lib/app-logger"
import { runStageAgent } from "../agent"
import { createOarmourMcpServer } from "../tools"
import { getPipelineStagePath } from "../storage"
import {
  ReportOutputSchema,
  type DedupeOutput,
  type Finding,
  type MergedFindingsFile,
  type ReportOutput,
} from "../schemas"
import { buildStageSystemPrompt, type StageContext } from "./context"

export async function runReport(
  ctx: StageContext,
  findings: MergedFindingsFile,
  dedupe: DedupeOutput,
): Promise<ReportOutput> {
  // Only non-suppressed, non-duplicate findings reach the report.
  const verdictByFinding = new Map(dedupe.verdicts.map((v) => [v.findingId, v.verdict]))
  const included: Finding[] = findings.findings.filter((f) => {
    const v = verdictByFinding.get(f.findingId)
    return v === "new" || v === "better_example_of_known"
  })

  const mcpServer = createOarmourMcpServer({
    storeId: ctx.storeId,
    version: ctx.version,
    runId: ctx.runId,
    runDir: ctx.runDir,
  })

  const prompt = [
    "# Task",
    "Write a structured per-finding analysis + a run summary for the deduped findings below.",
    "Preserve each finding's findingId, signalClass, severity, sourceFidelity,",
    "needsManualConfirmation. Add class, reachability, escalationPath, remediation, narrative.",
    "If the list is empty, write a Clean report (total: 0). Your final action MUST be",
    "`mcp__oarmour__commit_stage_output` stage=\"report\".",
    "",
    `## Deduped findings (${included.length})`,
    "```json",
    JSON.stringify(included, null, 2),
    "```",
  ].join("\n")

  const result = await runStageAgent({
    stage: "report",
    systemPrompt: buildStageSystemPrompt("report", ctx),
    prompt,
    mcpServer,
    runDir: ctx.runDir,
    modelId: ctx.modelId,
    maxTurns: 15,
  })

  const reportPath = getPipelineStagePath(ctx.runDir, "report")
  if (!result.ok || !fs.existsSync(reportPath)) {
    logError("[detection-pipeline] report agent did not commit; writing minimal report", { error: result.error })
    const fallback: ReportOutput = {
      summary: {
        total: included.length,
        bySeverity: { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 },
        newCount: included.length,
        needsManualConfirmationCount: included.filter((f) => f.needsManualConfirmation).length,
        overall: "Report agent did not produce structured output; findings listed without analysis.",
      },
      findings: included.map((f) => ({
        findingId: f.findingId,
        signalClass: f.signalClass,
        severity: f.severity,
        sourceFidelity: f.sourceFidelity,
        needsManualConfirmation: f.needsManualConfirmation,
        class: f.signalClass,
        reachability: f.reachability,
        escalationPath: "(unavailable)",
        remediation: f.remediation ?? "(unavailable)",
        narrative: f.pocSummary,
      })),
    }
    fs.writeFileSync(reportPath, JSON.stringify(fallback, null, 2), "utf-8")
    return fallback
  }

  const raw = JSON.parse(fs.readFileSync(reportPath, "utf8"))
  const parsed = ReportOutputSchema.safeParse(raw)
  if (!parsed.success) {
    logError("[detection-pipeline] report output failed schema", { error: parsed.error.message })
    // Write the raw back (best-effort) + return a coerced minimal shape.
    const fallback: ReportOutput = {
      summary: {
        total: included.length,
        bySeverity: { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 },
        newCount: included.length,
        needsManualConfirmationCount: 0,
        overall: "Report output failed schema validation; see 04-report.json raw.",
      },
      findings: [],
    }
    fs.writeFileSync(reportPath, JSON.stringify(fallback, null, 2), "utf-8")
    return fallback
  }

  logInfo("[detection-pipeline] report done", {
    total: parsed.data.summary.total,
    turns: result.numTurns,
  })
  return parsed.data
}
