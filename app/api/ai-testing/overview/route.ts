import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import {
  readAgentIncomingQueue,
  readAgentStatuses,
  type AgentQueueEntry,
  type AgentStatusEntry,
} from '@/lib/agent-queue'
import {
  buildQueueWithStatusLinks,
  buildStatusWithQueueLinks,
} from '@/lib/ai-testing-queue-status'
import { prisma } from '@/lib/prisma'
import type { JobStatus } from '@prisma/client'

export const runtime = 'nodejs'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const queue = readAgentIncomingQueue()
  const statuses = readAgentStatuses()

  const storeIds = Array.from(
    new Set([
      ...queue.map((q) => q.id),
      ...statuses.map((s) => s.id),
    ]),
  )

  const extensionRows =
    storeIds.length > 0
      ? await prisma.globalExtension.findMany({
          where: { storeId: { in: storeIds } },
          select: { storeId: true, name: true, id: true },
        })
      : []

  const nameByStoreId = new Map(extensionRows.map((e) => [e.storeId, e.name]))
  const extensionIdByStoreId = new Map(extensionRows.map((e) => [e.storeId, e.id]))

  const enrichAnalysis = async (items: AgentStatusEntry[]) => {
    const pairs = items.flatMap((status) => {
      const extensionId = extensionIdByStoreId.get(status.id)
      const runId = status.runId ?? (status.index !== undefined ? String(status.index) : '')
      if (!extensionId || !runId) return []
      return [{ storeId: status.id, extensionId, runId }]
    })
    if (pairs.length === 0) return new Map<string, { status: JobStatus; error: string | null }>()

    const analyses = await prisma.aiExtensionAnalysisResult.findMany({
      where: {
        OR: pairs.map((p) => ({ extensionId: p.extensionId, runId: p.runId })),
      },
      select: { extensionId: true, runId: true, status: true, error: true },
    })
    const byKey = new Map(
      analyses.map((row) => [`${row.extensionId}:${row.runId}`, row] as const),
    )
    const out = new Map<string, { status: JobStatus; error: string | null }>()
    for (const pair of pairs) {
      const row = byKey.get(`${pair.extensionId}:${pair.runId}`)
      if (row) out.set(`${pair.storeId}:${pair.runId}`, { status: row.status, error: row.error })
    }
    return out
  }

  const analysisByStoreRun = await enrichAnalysis(statuses)

  const queueLinks = buildQueueWithStatusLinks(queue, statuses).map((row) => ({
    ...row,
    extensionName: nameByStoreId.get(row.queue.id) ?? row.queue.name ?? row.queue.id,
  }))

  const statusLinks = buildStatusWithQueueLinks(queue, statuses).map((row) => {
    const runId = row.status.runId ?? (row.status.index !== undefined ? String(row.status.index) : '')
    const analysis = runId ? analysisByStoreRun.get(`${row.status.id}:${runId}`) : undefined
    return {
      ...row,
      extensionName: nameByStoreId.get(row.status.id) ?? row.status.id,
      analysisStatus: analysis?.status ?? null,
      analysisError: analysis?.error ?? null,
    }
  })

  return NextResponse.json({
    queue: queue.map((entry: AgentQueueEntry) => ({
      ...entry,
      extensionName: nameByStoreId.get(entry.id) ?? entry.name ?? entry.id,
    })),
    statuses: statuses.map((entry: AgentStatusEntry) => ({
      ...entry,
      extensionName: nameByStoreId.get(entry.id) ?? entry.id,
    })),
    queueLinks,
    statusLinks,
    updatedAt: new Date().toISOString(),
  })
}
