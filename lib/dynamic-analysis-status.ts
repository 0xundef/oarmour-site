import 'server-only'

import type { BrowserAgentTaskStatus, JobStatus } from '@prisma/client'
import { readAgentStatuses } from '@/lib/agent-queue'
import type { DynamicAnalysisDisplayStatus } from '@/lib/dynamic-analysis-display'
import { prisma } from '@/lib/prisma'
import { normalizeExtensionVersion } from '@/lib/workbench-check-items'

export type { DynamicAnalysisDisplayStatus } from '@/lib/dynamic-analysis-display'

function statusKey(storeId: string, version: string | null | undefined): string {
  return `${storeId}::${normalizeExtensionVersion(version)}`
}

export function resolveDynamicAnalysisDisplayStatus(input: {
  version: string | null | undefined
  taskStatus: BrowserAgentTaskStatus | null
  aiStatus: JobStatus | null
  agentQueueStatus: string | null
}): DynamicAnalysisDisplayStatus {
  const version = normalizeExtensionVersion(input.version)
  if (!version) return 'unavailable'

  const agent = (input.agentQueueStatus ?? '').trim().toLowerCase()
  if (agent === 'pending' || agent === 'running') return 'in_progress'

  const task = input.taskStatus
  if (task === 'QUEUED' || task === 'DISPATCHED' || task === 'RUNNING') return 'in_progress'

  const ai = input.aiStatus
  if (ai === 'PENDING' || ai === 'RUNNING') return 'in_progress'

  if (task === 'ERROR' || task === 'CANCELLED') return 'unavailable'
  if (ai === 'FAILED') return 'unavailable'

  if (ai === 'COMPLETED') return 'success'

  if (task === 'COMPLETE') {
    if (!ai) return 'in_progress'
    return 'success'
  }

  return 'unavailable'
}

/** Latest browser-agent + AI analysis state per extension row (keyed by `storeId`). */
export async function mapDynamicAnalysisStatusByStoreId(
  rows: Array<{ storeId: string; version: string | null }>,
): Promise<Map<string, DynamicAnalysisDisplayStatus>> {
  const storeIds = [...new Set(rows.map((r) => r.storeId).filter((id) => id.length > 0))]
  const out = new Map<string, DynamicAnalysisDisplayStatus>()
  if (storeIds.length === 0) return out

  const [tasks, aiResults] = await Promise.all([
    prisma.browserAgentTask.findMany({
      where: { storeId: { in: storeIds } },
      orderBy: { createdAt: 'desc' },
      select: { storeId: true, version: true, status: true },
    }),
    prisma.aiExtensionAnalysisResult.findMany({
      where: { storeId: { in: storeIds } },
      orderBy: { createdAt: 'desc' },
      select: { storeId: true, version: true, status: true },
    }),
  ])

  const taskByKey = new Map<string, (typeof tasks)[number]>()
  for (const task of tasks) {
    const key = statusKey(task.storeId, task.version)
    if (!taskByKey.has(key)) taskByKey.set(key, task)
  }

  const aiByKey = new Map<string, (typeof aiResults)[number]>()
  for (const ai of aiResults) {
    const key = statusKey(ai.storeId, ai.version)
    if (!aiByKey.has(key)) aiByKey.set(key, ai)
  }

  const agentByKey = new Map<string, string>()
  for (const entry of readAgentStatuses()) {
    const key = statusKey(entry.id, entry.version)
    if (!agentByKey.has(key)) agentByKey.set(key, entry.status)
  }

  for (const row of rows) {
    const key = statusKey(row.storeId, row.version)
    out.set(
      row.storeId,
      resolveDynamicAnalysisDisplayStatus({
        version: row.version,
        taskStatus: taskByKey.get(key)?.status ?? null,
        aiStatus: aiByKey.get(key)?.status ?? null,
        agentQueueStatus: agentByKey.get(key) ?? null,
      }),
    )
  }

  return out
}
