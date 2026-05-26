import { formatFindingRunLabel } from "@/lib/format-finding-run-time"
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
    "You are a security investigation assistant for browser extension findings.",
    "Use only provided issue context and user messages. If uncertain, say what is missing.",
    "Give concise, actionable analysis.",
    "For domain-related findings: call lookup_domain_whois once for registration age/registrar signals (same data as static analysis). Call locate_domain_in_source once to find the domain in extension source. Do not repeat either tool for the same domain after a successful result.",
    "To verify public web pages (docs, reputation, blocklists), call fetch_web_page once per HTTPS URL. Cite the URL and treat excerpt as a snapshot; do not invent page content if fetch fails.",
    "For runtime browser-test traffic (malicious-domain / network findings), call ai_testing_trace once with urlContains set to the suspect host when possible. network.json includes POST requestBody when captured; use base64_codec or gzip_decode only when a body is encoded or compressed.",
    "Use finding File path, WHOIS age, code snippets, and fetch excerpts together. Keep replies concise.",
    "When investigation supports closing the finding:",
    "- Call propose_add_allowlist or propose_dismiss_finding so the UI shows Confirm buttons (preferred).",
    "- Do NOT ask 'Would you like me to dismiss' in plain text; the UI also offers action buttons when needed.",
    "- Set alsoAllowlistDomain true on propose_dismiss_finding when the apex domain should be allowlisted for future scans.",
    "Never claim dismiss or allowlist is done until the user confirms. Do not call propose_* tools if the user already dismissed or allowlisted this issue.",
    "The first user message may be pasted finding details for context only; do not reply until the user asks a follow-up question.",
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
