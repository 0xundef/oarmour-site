import "server-only"

import type { ReportOutput } from "./schemas"

const SEVERITY_EMOJI: Record<string, string> = {
  CRITICAL: "🔴",
  HIGH: "🟠",
  MEDIUM: "🟡",
  LOW: "🟢",
}

const SEVERITY_ORDER = ["CRITICAL", "HIGH", "MEDIUM", "LOW"]

/**
 * Deterministic JSON → markdown renderer. `report.md` is a cached render of
 * `04-report.json`; regenerable on demand via `GET /api/detection-pipeline/.../report.md`.
 * Markdown is NOT the source of truth.
 */
export function renderReportMarkdown(report: ReportOutput, header?: { storeId: string; version: string; runId: string }): string {
  const lines: string[] = []
  if (header) {
    lines.push(`# Detection report — ${header.storeId}`)
    lines.push("")
    lines.push(`- **Version:** ${header.version}`)
    lines.push(`- **Run:** ${header.runId}`)
    lines.push("")
  } else {
    lines.push("# Detection report")
    lines.push("")
  }

  const { summary, findings } = report
  lines.push(`> ${summary.overall}`)
  lines.push("")
  lines.push(`**Total:** ${summary.total} · **New:** ${summary.newCount} · **Needs manual confirmation:** ${summary.needsManualConfirmationCount}`)
  lines.push("")

  if (findings.length === 0) {
    lines.push("## ✅ Clean")
    lines.push("")
    lines.push("No findings matching the threat model. `'Clean' is a valid result.`")
    lines.push("")
    return lines.join("\n")
  }

  const bySev = new Map<string, typeof findings>()
  for (const f of findings) {
    const arr = bySev.get(f.severity) ?? []
    arr.push(f)
    bySev.set(f.severity, arr)
  }

  for (const sev of SEVERITY_ORDER) {
    const group = bySev.get(sev)
    if (!group || group.length === 0) continue
    lines.push(`## ${SEVERITY_EMOJI[sev]} ${sev} (${group.length})`)
    lines.push("")
    for (const f of group) {
      const confirmBadge = f.needsManualConfirmation ? " · ⚠️ **needs manual confirmation**" : ""
      const fidelityBadge = `· fidelity: \`${f.sourceFidelity}\``
      lines.push(`### ${f.class} — \`${f.signalClass}\` ${confirmBadge}`)
      lines.push("")
      lines.push(`- **Finding:** \`${f.findingId}\``)
      lines.push(`- **Severity:** ${f.severity} ${fidelityBadge}`)
      lines.push(`- **Reachability:** ${f.reachability}`)
      lines.push(`- **Escalation path:** ${f.escalationPath}`)
      lines.push(`- **Remediation:** ${f.remediation}`)
      lines.push("")
      lines.push(f.narrative)
      lines.push("")
    }
  }

  return lines.join("\n")
}
