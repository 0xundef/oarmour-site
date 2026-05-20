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
  }
}

export function buildIssueChatSystem(issue: IssueChatContext): string {
  return [
    "You are a security investigation assistant for browser extension findings.",
    "Use only provided issue context and user messages. If uncertain, say what is missing.",
    "Give concise, actionable analysis.",
    "",
    "Current issue context:",
    `- id: ${issue.id}`,
    `- source: ${issue.source}`,
    `- severity: ${issue.severity}`,
    `- title: ${issue.title}`,
    `- file: ${issue.file}`,
    `- summary: ${issue.summary}`,
    `- conditions: ${issue.conditions.join(" | ")}`,
    `- impact: ${issue.impact}`,
  ].join("\n")
}
