import { formatFindingRunLabel } from "@/lib/format-finding-run-time"
import { loadSkill } from "@/lib/investigation/load-skill"
import type { WorkbenchCheckItem } from "@/lib/workbench-check-items"

export type IssueChatContext = {
  id: string
  source: "static" | "ai"
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW"
  title: string
  file: string
  summary: string
  conditions: string[]
  impact: string
  detectedAt: string | null
}

export function toIssueChatContext(issue: WorkbenchCheckItem): IssueChatContext {
  return {
    id: issue.id,
    source: issue.source,
    severity: issue.severity,
    title: issue.title,
    file: issue.file,
    summary: issue.summary,
    conditions: issue.conditions,
    impact: issue.impact,
    detectedAt: issue.detectedAt,
  }
}

export function buildIssueChatSystem(issue: IssueChatContext): string {
  return [
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
  ].join("\n")
}

/** Detail panel text seeded as the first user message (display only; no auto-reply). */
export function buildIssueDetailContextText(issue: WorkbenchCheckItem): string {
  const conditions =
    issue.conditions.length > 0
      ? issue.conditions.map((line) => `- ${line}`).join("\n")
      : "- (none listed)"

  return [
    "Finding details (conversation context):",
    "",
    `${issue.title}`,
    `${issue.severity} · ${issue.source} · ${issue.category}`,
    formatFindingRunLabel(issue.source, issue.detectedAt),
    `File: ${issue.file}`,
    "",
    "Summary",
    issue.summary,
    "",
    "Conditions",
    conditions,
    "",
    "Impact",
    issue.impact,
  ].join("\n")
}
