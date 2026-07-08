import "server-only"

import fs from "fs"
import {
  KnownFindingsManifestSchema,
  type KnownFindingsManifest,
} from "./schemas"
import { getKnownFindingsPath } from "./storage"

/** Load the store-scoped cross-run dedup memory. Returns an empty manifest if none exists. */
export function loadKnownFindings(storeId: string): KnownFindingsManifest {
  const p = getKnownFindingsPath(storeId)
  if (!fs.existsSync(p)) {
    return {
      storeId,
      updatedAt: new Date(0).toISOString(),
      findings: [],
    }
  }
  const raw = JSON.parse(fs.readFileSync(p, "utf8"))
  const parsed = KnownFindingsManifestSchema.safeParse(raw)
  if (!parsed.success) {
    // Corrupt manifest — start fresh rather than crashing the run.
    return { storeId, updatedAt: new Date(0).toISOString(), findings: [] }
  }
  return parsed.data
}

/** Persist the store-scoped cross-run dedup memory. */
export function saveKnownFindings(manifest: KnownFindingsManifest): void {
  const p = getKnownFindingsPath(manifest.storeId)
  fs.mkdirSync(p.replace(/known_findings\.json$/, ""), { recursive: true })
  fs.writeFileSync(p, JSON.stringify(manifest, null, 2), "utf-8")
}

/**
 * Apply dedupe verdicts to the known-findings manifest deterministically
 * (the dedupe agent only judges; side-effects happen here).
 *  - new → append a new known finding.
 *  - better_example_of_known → update bestEvidence + lastSeenRun.
 *  - duplicate_skip → bump lastSeenRun only.
 *  - suppressed → no change to known_findings (suppression is a separate concern).
 */
export function applyVerdictsToKnownFindings(
  manifest: KnownFindingsManifest,
  verdicts: Array<{
    findingId: string
    verdict: "new" | "better_example_of_known" | "duplicate_skip" | "suppressed"
    matchedKnownId: string | null
  }>,
  findingsById: Map<string, { signalClass: string; severity: string; evidence?: Array<{ file: string; anchor: string }> }>,
  runId: string,
): KnownFindingsManifest {
  const byId = new Map(manifest.findings.map((f) => [f.findingId, f]))
  for (const v of verdicts) {
    if (v.verdict === "suppressed") continue
    const finding = findingsById.get(v.findingId)
    if (v.verdict === "new") {
      if (byId.has(v.findingId)) {
        // Already known (e.g. from a prior run) — treat as duplicate_skip.
        const k = byId.get(v.findingId)!
        k.lastSeenRun = runId
        continue
      }
      const bestEvidence =
        finding?.evidence?.[0]
          ? `${finding.evidence[0].file}:${finding.evidence[0].anchor}`
          : "unknown"
      const k = {
        findingId: v.findingId,
        signalClass: (finding?.signalClass ?? "dataflow") as KnownFindingsManifest["findings"][number]["signalClass"],
        severity: (finding?.severity ?? "MEDIUM") as KnownFindingsManifest["findings"][number]["severity"],
        firstSeenRun: runId,
        lastSeenRun: runId,
        status: "active" as const,
        bestEvidenceRef: bestEvidence,
      }
      byId.set(v.findingId, k)
    } else {
      const targetId = v.matchedKnownId ?? v.findingId
      const k = byId.get(targetId)
      if (!k) continue
      k.lastSeenRun = runId
      if (v.verdict === "better_example_of_known" && finding?.evidence?.[0]) {
        k.bestEvidenceRef = `${finding.evidence[0].file}:${finding.evidence[0].anchor}`
      }
    }
  }
  return {
    ...manifest,
    storeId: manifest.storeId,
    updatedAt: new Date().toISOString(),
    findings: Array.from(byId.values()),
  }
}
