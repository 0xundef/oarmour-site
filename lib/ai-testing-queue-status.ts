import type { AgentQueueEntry, AgentStatusEntry } from '@/lib/agent-queue'

export type AiTestingQueueStatusLink = {
  queue: AgentQueueEntry
  status: AgentStatusEntry | null
  linkKey: string
}

export type AiTestingStatusQueueLink = {
  status: AgentStatusEntry
  inQueue: boolean
  queueEntry: AgentQueueEntry | null
  linkKey: string
}

function resolveRunId(entry: { runId?: string; index?: number }): string {
  if (entry.runId?.trim()) return entry.runId.trim()
  if (entry.index !== undefined && Number.isFinite(entry.index)) return String(entry.index)
  return ''
}

export function queueStatusLinkKey(
  storeId: string,
  version: string,
  runId?: string,
  index?: number,
): string {
  return `${storeId}|${version}|${resolveRunId({ runId, index })}`
}

/** Same matching rules as pi-agent-browser `unhandledQueue` / `removeFromIncomingQueue`. */
export function agentStatusMatchesQueue(
  status: AgentStatusEntry,
  queue: AgentQueueEntry,
): boolean {
  if (status.id !== queue.id || status.version !== queue.version) return false
  const queueRunId = resolveRunId(queue)
  const statusRunId = resolveRunId(status)
  if (queueRunId && statusRunId) return queueRunId === statusRunId
  if (queue.index !== undefined && status.index !== undefined) return queue.index === status.index
  return true
}

export function findStatusForQueue(
  queue: AgentQueueEntry,
  statuses: AgentStatusEntry[],
): AgentStatusEntry | null {
  const matches = statuses.filter((s) => agentStatusMatchesQueue(s, queue))
  if (matches.length === 0) return null
  return matches.sort(
    (a, b) => Date.parse(b.status_time || '') - Date.parse(a.status_time || ''),
  )[0]
}

export function findQueueForStatus(
  status: AgentStatusEntry,
  queue: AgentQueueEntry[],
): AgentQueueEntry | null {
  return queue.find((q) => agentStatusMatchesQueue(status, q)) ?? null
}

export function buildQueueWithStatusLinks(
  queue: AgentQueueEntry[],
  statuses: AgentStatusEntry[],
): AiTestingQueueStatusLink[] {
  return queue.map((entry) => ({
    queue: entry,
    status: findStatusForQueue(entry, statuses),
    linkKey: queueStatusLinkKey(entry.id, entry.version, entry.runId, entry.index),
  }))
}

export function buildStatusWithQueueLinks(
  queue: AgentQueueEntry[],
  statuses: AgentStatusEntry[],
): AiTestingStatusQueueLink[] {
  const sorted = [...statuses].sort(
    (a, b) => Date.parse(b.status_time || '') - Date.parse(a.status_time || ''),
  )
  return sorted.map((status) => {
    const queueEntry = findQueueForStatus(status, queue)
    return {
      status,
      inQueue: queueEntry !== null,
      queueEntry,
      linkKey: queueStatusLinkKey(status.id, status.version, status.runId, status.index),
    }
  })
}
