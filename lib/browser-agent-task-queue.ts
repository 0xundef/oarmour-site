import 'server-only'
import type { BrowserAgentTaskStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { readAgentStatuses } from '@/lib/agent-queue'
import {
  agentApiFetch,
  getBrowserAgentApiBaseUrl,
  resolveBrowserAgentMaxConcurrent,
} from '@/lib/browser-agent-api-client'

function buildSessionId(storeId: string, version: string) {
  const safeVersion = version.replace(/[^a-zA-Z0-9._-]+/g, '_')
  return `${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}-${storeId.slice(0, 8)}-${safeVersion}`
}

const ACTIVE_DB_STATUSES: BrowserAgentTaskStatus[] = ['QUEUED', 'DISPATCHED', 'RUNNING']

function mapAgentStatusToDb(
  status: 'pending' | 'running' | 'complete' | 'error',
): BrowserAgentTaskStatus {
  switch (status) {
    case 'running':
      return 'RUNNING'
    case 'complete':
      return 'COMPLETE'
    case 'error':
      return 'ERROR'
    default:
      return 'DISPATCHED'
  }
}

export async function syncBrowserAgentTasksFromStatus() {
  const statuses = readAgentStatuses()
  if (statuses.length === 0) return

  const sessionIds = statuses.map((s) => s.runId).filter(Boolean) as string[]
  if (sessionIds.length === 0) return

  const tasks = await prisma.browserAgentTask.findMany({
    where: { sessionId: { in: sessionIds } },
  })
  const taskBySession = new Map(tasks.map((t) => [t.sessionId, t]))

  for (const row of statuses) {
    if (!row.runId) continue
    const task = taskBySession.get(row.runId)
    if (!task) continue
    if (task.status === 'CANCELLED' || task.status === 'COMPLETE' || task.status === 'ERROR') continue

    const nextStatus = mapAgentStatusToDb(row.status)
    const terminal = nextStatus === 'COMPLETE' || nextStatus === 'ERROR'
    await prisma.browserAgentTask.update({
      where: { id: task.id },
      data: {
        status: nextStatus,
        error: row.error ?? null,
        completedAt: terminal ? new Date() : task.completedAt,
      },
    })
  }
}

async function countActiveDispatchedTasks() {
  return prisma.browserAgentTask.count({
    where: { status: { in: ['DISPATCHED', 'RUNNING'] } },
  })
}

export async function dispatchBrowserAgentTasks() {
  if (process.env.AGENT_TESTING_ENABLED === '0') return

  await syncBrowserAgentTasksFromStatus()

  const maxConcurrent = resolveBrowserAgentMaxConcurrent()
  let activeCount = await countActiveDispatchedTasks()

  if (getBrowserAgentApiBaseUrl()) {
    try {
      const health = await agentApiFetch<{
        activeRuns?: number
        maxConcurrentRuns?: number
      }>('/health')
      if (typeof health.activeRuns === 'number') activeCount = health.activeRuns
      if (typeof health.maxConcurrentRuns === 'number' && health.maxConcurrentRuns > 0) {
        // Prefer agent-reported capacity when available.
        while (activeCount < health.maxConcurrentRuns) {
          const task = await prisma.browserAgentTask.findFirst({
            where: { status: 'QUEUED' },
            orderBy: { createdAt: 'asc' },
          })
          if (!task) break

          try {
            await agentApiFetch('/v1/sessions', {
              method: 'POST',
              body: JSON.stringify({
                extensionId: task.storeId,
                storeId: task.storeId,
                version: task.version,
                sessionId: task.sessionId,
                name: task.extensionName,
              }),
            })
            await prisma.browserAgentTask.update({
              where: { id: task.id },
              data: { status: 'DISPATCHED', dispatchedAt: new Date(), error: null },
            })
            activeCount += 1
          } catch (e) {
            const message = e instanceof Error ? e.message : String(e)
            if (message.includes('429') || message.includes('at_capacity')) break
            await prisma.browserAgentTask.update({
              where: { id: task.id },
              data: { status: 'ERROR', error: message, completedAt: new Date() },
            })
          }
        }
        await syncBrowserAgentTasksFromStatus()
        return
      }
    } catch {
      // Fall back to DB-only active count below.
    }
  }

  while (activeCount < maxConcurrent) {
    const task = await prisma.browserAgentTask.findFirst({
      where: { status: 'QUEUED' },
      orderBy: { createdAt: 'asc' },
    })
    if (!task) break

    const base = getBrowserAgentApiBaseUrl()
    if (!base) break

    try {
      await agentApiFetch('/v1/sessions', {
        method: 'POST',
        body: JSON.stringify({
          extensionId: task.storeId,
          storeId: task.storeId,
          version: task.version,
          sessionId: task.sessionId,
          name: task.extensionName,
        }),
      })
      await prisma.browserAgentTask.update({
        where: { id: task.id },
        data: { status: 'DISPATCHED', dispatchedAt: new Date(), error: null },
      })
      activeCount += 1
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      if (message.includes('429') || message.includes('at_capacity')) break
      await prisma.browserAgentTask.update({
        where: { id: task.id },
        data: { status: 'ERROR', error: message, completedAt: new Date() },
      })
    }
  }

  await syncBrowserAgentTasksFromStatus()
}

export async function enqueueBrowserAgentTask(input: {
  storeId: string
  name?: string | null
  version: string | null | undefined
  reason: string
}) {
  if (process.env.AGENT_TESTING_ENABLED === '0') {
    return { queued: false as const, reason: 'disabled' as const }
  }
  if (!input.version?.trim()) {
    return { queued: false as const, reason: 'missing_version' as const }
  }

  const storeId = input.storeId.trim()
  const version = input.version.trim()

  const existing = await prisma.browserAgentTask.findFirst({
    where: {
      storeId,
      version,
      status: { in: ACTIVE_DB_STATUSES },
    },
    orderBy: { createdAt: 'desc' },
  })
  if (existing) {
    return { queued: false as const, reason: 'already_queued' as const, sessionId: existing.sessionId }
  }

  const sessionId = buildSessionId(storeId, version)
  const task = await prisma.browserAgentTask.create({
    data: {
      sessionId,
      storeId,
      version,
      extensionName: input.name?.trim() || null,
      reason: input.reason,
      status: 'QUEUED',
    },
  })

  await dispatchBrowserAgentTasks()

  return { queued: true as const, sessionId: task.sessionId, taskId: task.id }
}

export async function cancelBrowserAgentTask(sessionId: string) {
  const task = await prisma.browserAgentTask.findUnique({ where: { sessionId } })
  if (!task) return { ok: false as const, reason: 'not_found' as const }

  if (task.status === 'COMPLETE' || task.status === 'ERROR' || task.status === 'CANCELLED') {
    return { ok: false as const, reason: 'already_finished' as const }
  }

  if (task.status === 'QUEUED') {
    await prisma.browserAgentTask.update({
      where: { id: task.id },
      data: { status: 'CANCELLED', completedAt: new Date(), error: 'Cancelled by operator' },
    })
    await dispatchBrowserAgentTasks()
    return { ok: true as const, action: 'removed_from_queue' as const }
  }

  if (getBrowserAgentApiBaseUrl()) {
    try {
      await agentApiFetch(`/v1/sessions/${encodeURIComponent(sessionId)}`, { method: 'DELETE' })
    } catch {
      // Best effort; still mark cancelled in DB.
    }
  }

  await prisma.browserAgentTask.update({
    where: { id: task.id },
    data: { status: 'CANCELLED', completedAt: new Date(), error: 'Cancelled by operator' },
  })
  await syncBrowserAgentTasksFromStatus()
  await dispatchBrowserAgentTasks()
  return { ok: true as const, action: 'cancel_requested' as const }
}

export async function listBrowserAgentTasks(limit = 100) {
  await dispatchBrowserAgentTasks()
  return prisma.browserAgentTask.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
  })
}
