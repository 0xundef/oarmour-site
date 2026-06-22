import { formatFindingRunLabel } from "@/lib/format-finding-run-time"
import { loadSkill } from "@/lib/investigation/load-skill"
import type { IssueChatContext } from "@/lib/issue-chat-context"

import "server-only"

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
