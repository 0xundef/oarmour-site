import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { readAgentStatuses, type AgentStatusEntry } from '@/lib/agent-queue'
import { prisma } from '@/lib/prisma'
import type { JobStatus } from '@prisma/client'

export const runtime = 'nodejs'

type LatestStatus = {
  status: AgentStatusEntry['status']
  version: string
  runId?: string
  status_time?: string
  analysisStatus?: JobStatus | null
  analysisError?: string | null
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const all = readAgentStatuses()
  const byId: Record<string, LatestStatus> = {}
  for (const entry of all) {
    if (!entry?.id) continue
    const incoming = Date.parse(entry.status_time || '') || 0
    const existing = byId[entry.id]
    const existingTime = existing ? Date.parse(existing.status_time || '') || 0 : -1
    if (!existing || incoming > existingTime) {
      byId[entry.id] = {
        status: entry.status,
        version: entry.version,
        runId: entry.runId,
        status_time: entry.status_time,
      }
    }
  }

  const storeIds = Object.keys(byId)
  if (storeIds.length > 0) {
    const extensions = await prisma.globalExtension.findMany({
      where: { storeId: { in: storeIds } },
      select: { id: true, storeId: true },
    })
    const extensionIdByStoreId = new Map(extensions.map((ext) => [ext.storeId, ext.id]))

    const lookupPairs = storeIds.flatMap((storeId) => {
      const runId = byId[storeId]?.runId
      const extensionId = extensionIdByStoreId.get(storeId)
      if (!runId || !extensionId) return []
      return [{ extensionId, runId, storeId }]
    })

    if (lookupPairs.length > 0) {
      const analyses = await prisma.aiExtensionAnalysisResult.findMany({
        where: {
          OR: lookupPairs.map((pair) => ({
            extensionId: pair.extensionId,
            runId: pair.runId,
          })),
        },
        select: {
          extensionId: true,
          runId: true,
          status: true,
          error: true,
        },
      })
      const analysisByKey = new Map(
        analyses.map((row) => [`${row.extensionId}:${row.runId}`, row] as const),
      )
      for (const pair of lookupPairs) {
        const row = analysisByKey.get(`${pair.extensionId}:${pair.runId}`)
        if (!row) continue
        const current = byId[pair.storeId]
        if (!current) continue
        byId[pair.storeId] = {
          ...current,
          analysisStatus: row.status,
          analysisError: row.error,
        }
      }
    }
  }

  return NextResponse.json({ statuses: byId })
}
