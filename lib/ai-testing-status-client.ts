export type AiTestingStatus = "pending" | "running" | "complete" | "error"

export type AiTestingStatusEntry = {
  agentStatus: AiTestingStatus
  analysisStatus?: string | null
  analysisError?: string | null
}

const ACTIVE_STATUSES = new Set<AiTestingStatus>(["pending", "running"])

export type AiTestingSparkleOutcome = "idle" | "active" | "success" | "failed"

export function resolveAiTestingSparkleOutcome(
  entry: AiTestingStatusEntry | undefined,
  pending: boolean,
): AiTestingSparkleOutcome {
  if (pending) return "active"
  if (!entry) return "idle"
  if (ACTIVE_STATUSES.has(entry.agentStatus)) return "active"
  if (entry.agentStatus === "error" || entry.analysisStatus === "FAILED") return "failed"
  if (entry.analysisStatus === "COMPLETED") return "success"
  if (entry.agentStatus === "complete") return "active"
  return "idle"
}

export async function loadAiTestingStatusMap(): Promise<Record<string, AiTestingStatusEntry>> {
  const res = await fetch("/api/ai-testing/statuses", { cache: "no-store" })
  if (!res.ok) return {}

  const payload = (await res.json().catch(() => null)) as
    | {
        statuses?: Record<
          string,
          {
            status?: string
            analysisStatus?: string | null
            analysisError?: string | null
          }
        >
      }
    | null

  const statuses = payload?.statuses
  if (!statuses) return {}

  const next: Record<string, AiTestingStatusEntry> = {}
  for (const [storeId, entry] of Object.entries(statuses)) {
    const status = entry?.status
    if (status === "pending" || status === "running" || status === "complete" || status === "error") {
      next[storeId] = {
        agentStatus: status,
        analysisStatus: entry?.analysisStatus ?? null,
        analysisError: entry?.analysisError ?? null,
      }
    }
  }
  return next
}

export function mergeAiTestingStatusMaps(
  prev: Record<string, AiTestingStatusEntry>,
  next: Record<string, AiTestingStatusEntry>,
): Record<string, AiTestingStatusEntry> {
  const merged: Record<string, AiTestingStatusEntry> = { ...next }
  for (const [storeId, entry] of Object.entries(prev)) {
    if (entry.agentStatus === "pending" && !next[storeId]) {
      merged[storeId] = entry
    }
  }
  return merged
}
