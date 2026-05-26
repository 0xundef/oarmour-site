import 'server-only'
import {
  mapDbStatusToTaskUi,
  type BrowserAgentTaskUiStatus,
} from '@/lib/browser-agent-task-ui-status'
import {
  cancelBrowserAgentTask,
  listBrowserAgentTasks,
} from '@/lib/browser-agent-task-queue'
import { enqueueAgentBrowserTestTask, readAgentStatuses } from '@/lib/agent-queue'
import {
  agentApiFetch,
  getBrowserAgentApiBaseUrl,
} from '@/lib/browser-agent-api-client'

export { getBrowserAgentApiBaseUrl } from '@/lib/browser-agent-api-client'

export type PlaywrightCliSession = {
  name: string
  [key: string]: unknown
}

export type BrowserAgentTaskSession = {
  sessionId: string
  extensionId: string
  extensionName?: string
  version: string
  status: BrowserAgentTaskUiStatus
  error?: string
  queuedAt?: string
  updatedAt?: string
  duration?: number
  inQueue: boolean
}

function mapDbTaskToSession(
  task: Awaited<ReturnType<typeof listBrowserAgentTasks>>[number],
  durationBySessionId: Map<string, number>,
): BrowserAgentTaskSession {
  return {
    sessionId: task.sessionId,
    extensionId: task.storeId,
    extensionName: task.extensionName ?? undefined,
    version: task.version,
    status: mapDbStatusToTaskUi(task.status),
    error: task.error ?? undefined,
    queuedAt: task.createdAt.toISOString(),
    updatedAt: (task.dispatchedAt ?? task.completedAt ?? task.updatedAt).toISOString(),
    duration: durationBySessionId.get(task.sessionId),
    inQueue: task.status === 'QUEUED',
  }
}

export async function listPlaywrightSessions(): Promise<{
  sessions: PlaywrightCliSession[]
  updatedAt: string
  source: 'api' | 'unconfigured'
}> {
  const base = getBrowserAgentApiBaseUrl()
  if (!base) {
    return { sessions: [], updatedAt: new Date().toISOString(), source: 'unconfigured' }
  }
  const payload = await agentApiFetch<{ sessions: PlaywrightCliSession[]; updatedAt?: string }>(
    '/v1/playwright/sessions',
  )
  return {
    sessions: payload.sessions ?? [],
    updatedAt: payload.updatedAt ?? new Date().toISOString(),
    source: 'api',
  }
}

export async function killAllPlaywrightSessions(force = false): Promise<void> {
  await agentApiFetch('/v1/playwright/sessions/kill-all', {
    method: 'POST',
    body: JSON.stringify({ force }),
  })
}

export async function closePlaywrightSession(name: string): Promise<void> {
  await agentApiFetch(`/v1/playwright/sessions/${encodeURIComponent(name)}`, {
    method: 'DELETE',
  })
}

export async function listTaskSessions(): Promise<{
  sessions: BrowserAgentTaskSession[]
  updatedAt: string
  source: 'db'
}> {
  const tasks = await listBrowserAgentTasks()
  const statuses = readAgentStatuses()
  const durationBySessionId = new Map<string, number>()
  for (const row of statuses) {
    if (row.runId && row.duration !== undefined) {
      durationBySessionId.set(row.runId, row.duration)
    }
  }
  return {
    sessions: tasks.map((task) => mapDbTaskToSession(task, durationBySessionId)),
    updatedAt: new Date().toISOString(),
    source: 'db',
  }
}

export async function enqueueTaskSession(input: {
  extensionId: string
  version: string
  name?: string | null
}): Promise<{ sessionId: string; source: 'db' }> {
  const result = await enqueueAgentBrowserTestTask({
    storeId: input.extensionId,
    name: input.name,
    version: input.version,
    reason: 'admin_browser_agent',
  })
  if (!result.queued) {
    throw new Error(result.reason)
  }
  return { sessionId: result.entry.runId, source: 'db' }
}

export async function cancelTaskSession(sessionId: string): Promise<void> {
  const result = await cancelBrowserAgentTask(sessionId.trim())
  if (!result.ok) {
    throw new Error(result.reason)
  }
}
