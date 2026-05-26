import 'server-only'

import { mapDbStatusToSparkle } from '@/lib/browser-agent-task-ui-status'
import type { DynamicAnalysisDisplayStatus } from '@/lib/dynamic-analysis-display'
import { syncBrowserAgentTasksFromStatus } from '@/lib/browser-agent-task-queue'
import { prisma } from '@/lib/prisma'
import { normalizeExtensionVersion } from '@/lib/workbench-check-items'

export type { DynamicAnalysisDisplayStatus } from '@/lib/dynamic-analysis-display'

function statusKey(storeId: string, version: string | null | undefined): string {
  return `${storeId}::${normalizeExtensionVersion(version)}`
}

/**
 * Latest `BrowserAgentTask` for the extension row version — same source as
 * Admin → AI test sessions → Status column.
 */
export async function mapDynamicAnalysisStatusByStoreId(
  rows: Array<{ storeId: string; version: string | null }>,
): Promise<Map<string, DynamicAnalysisDisplayStatus>> {
  const storeIds = [...new Set(rows.map((r) => r.storeId).filter((id) => id.length > 0))]
  const out = new Map<string, DynamicAnalysisDisplayStatus>()
  if (storeIds.length === 0) return out

  await syncBrowserAgentTasksFromStatus()

  const tasks = await prisma.browserAgentTask.findMany({
    where: { storeId: { in: storeIds } },
    orderBy: { createdAt: 'desc' },
    select: { storeId: true, version: true, status: true },
  })

  const latestTaskByKey = new Map<string, (typeof tasks)[number]>()
  for (const task of tasks) {
    const key = statusKey(task.storeId, task.version)
    if (!latestTaskByKey.has(key)) latestTaskByKey.set(key, task)
  }

  for (const row of rows) {
    const key = statusKey(row.storeId, row.version)
    const latest = latestTaskByKey.get(key)
    out.set(row.storeId, mapDbStatusToSparkle(latest?.status))
  }

  return out
}
