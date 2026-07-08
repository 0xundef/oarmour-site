import { formatFindingRunLabel } from "@/lib/format-finding-run-time"
import { loadSkill } from "@/lib/investigation/load-skill"
import type { IssueChatContext } from "@/lib/issue-chat-context"
import { readPipelineReportMarkdown } from "@/lib/detection-pipeline/storage"

import "server-only"

export function buildIssueChatSystem(issue: IssueChatContext, storeId?: string): string {
  const lines = [
    loadSkill("triage"),
    "",
    "Current issue context:",
    `- id: ${issue.id}`,
    `- source: ${issue.source}`,
    `- severity: ${issue.severity}`,
    `- title: ${issue.title}`,
    `- file: ${issue.file}`,
    `- scan batch: ${formatFindingRunLabel(issue.source, issue.detectedAt)}`,
    `- summary: ${issue.summary}`,
    `- conditions: ${issue.conditions.join(" | ")}`,
    `- impact: ${issue.impact}`,
  ]
  if (storeId) {
    // Seed the latest AI-analysis report as background for joint human review.
    // Stage JSON is available on demand via the read_pipeline_stage tool.
    const report = readPipelineReportMarkdown(storeId)
    if (report) {
      lines.push(
        "",
        "## AI analysis report (latest pipeline run)",
        `run: ${report.runId} · started: ${report.startedAt} · fidelity: ${report.sourceFidelity}`,
        "Treat this report as background context for the current finding. The full per-stage",
        "JSON (recon/findings/dedupe/report/manifest) is available via the read_pipeline_stage tool.",
        "",
        report.markdown,
      )
    }
  }
  return lines.join("\n")
}
