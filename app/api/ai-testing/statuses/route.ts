import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { readAgentStatuses, type AgentStatusEntry } from '@/lib/agent-queue'

export const runtime = 'nodejs'

type LatestStatus = {
  status: AgentStatusEntry['status']
  version: string
  runId?: string
  status_time?: string
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

  return NextResponse.json({ statuses: byId })
}
