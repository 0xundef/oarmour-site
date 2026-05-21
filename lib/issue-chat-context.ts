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
    "For domain-related findings: call lookup_domain_whois once for registration age/registrar signals (same data as static analysis). Call locate_domain_in_source once to find the domain in extension source. Do not repeat either tool for the same domain after a successful result. Use finding File path, WHOIS age, and code snippets together. Keep replies concise.",
    "The first user message may be pasted finding details for context only; do not reply until the user asks a follow-up question.",
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
