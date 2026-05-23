import fs from 'fs'
import path from 'path'
import {
  getAgentCliConfigTemplatePath,
  getAgentDefaultPromptPath,
  getAgentIncomingQueuePath,
  getAgentStatusPath,
  getExtensionArtifactRoot,
  hasResolvableAgentPrompt,
} from '@/lib/extension-storage'

export type AgentQueueEntry = {
  id: string
  name?: string
  version: string
  index: number
  runId: string
  artifactRoot: string
  reason: string
  incoming_time: string
}

export type AgentStatusEntry = {
  id: string
  version: string
  runId?: string
  status: 'pending' | 'running' | 'complete' | 'error'
  error?: string
  index?: number
  status_time?: string
  duration?: number
  recordingsPath?: string
}

function readJsonArray<T>(filePath: string): T[] {
  if (!fs.existsSync(filePath)) return []
  const raw = fs.readFileSync(filePath, 'utf8').trim()
  if (!raw) return []
  const parsed = JSON.parse(raw) as unknown
  return Array.isArray(parsed) ? (parsed as T[]) : []
}

function writeJsonAtomic(filePath: string, data: unknown) {
  const dir = path.dirname(filePath)
  fs.mkdirSync(dir, { recursive: true })
  const tmpPath = path.join(dir, `.${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`)
  fs.writeFileSync(tmpPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8')
  fs.renameSync(tmpPath, filePath)
}

function buildRunId(storeId: string, version: string) {
  const safeVersion = version.replace(/[^a-zA-Z0-9._-]+/g, '_')
  return `${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}-${storeId.slice(0, 8)}-${safeVersion}`
}

const BUNDLED_DEFAULT_PROMPT_REL = ['lib', 'agent-queue', 'default-extension-test-prompt.md'] as const
const BUNDLED_CLI_CONFIG_TEMPLATE_REL = ['lib', 'agent-queue', 'cli_config_template.json'] as const

/** Copy repo-bundled generic prompt into `AGENT_QUEUE_ROOT/prompt.md` if missing (browseragent fallback). */
export function syncAgentQueueDefaultPromptFromBundled(): void {
  const dest = getAgentDefaultPromptPath()
  if (fs.existsSync(dest)) return
  const src = path.join(process.cwd(), ...BUNDLED_DEFAULT_PROMPT_REL)
  if (!fs.existsSync(src)) return
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  fs.copyFileSync(src, dest)
}

/** Copy `cli_config_template.json` into `AGENT_QUEUE_ROOT` if missing (editable on disk; variables filled per extension). */
export function syncAgentQueueCliConfigTemplateFromBundled(): void {
  const dest = getAgentCliConfigTemplatePath()
  if (fs.existsSync(dest)) return
  const src = path.join(process.cwd(), ...BUNDLED_CLI_CONFIG_TEMPLATE_REL)
  if (!fs.existsSync(src)) return
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  fs.copyFileSync(src, dest)
}

export function enqueueAgentBrowserTestTask(input: {
  storeId: string
  name?: string | null
  version: string | null | undefined
  reason: string
}) {
  if (process.env.AGENT_TESTING_ENABLED === '0') {
    return { queued: false as const, reason: 'disabled' as const }
  }
  if (!input.version) {
    return { queued: false as const, reason: 'missing_version' as const }
  }

  syncAgentQueueDefaultPromptFromBundled()
  syncAgentQueueCliConfigTemplateFromBundled()
  if (!hasResolvableAgentPrompt(input.storeId)) {
    return { queued: false as const, reason: 'missing_prompt' as const }
  }

  const queuePath = getAgentIncomingQueuePath()
  const queue = readJsonArray<AgentQueueEntry>(queuePath)
  const statuses = readJsonArray<AgentStatusEntry>(getAgentStatusPath())
  const hasActiveStatus = statuses.some(
    (item) =>
      item.id === input.storeId &&
      item.version === input.version &&
      (item.status === 'pending' || item.status === 'running'),
  )
  const hasActiveQueue = queue.some((queueEntry) => {
    if (queueEntry.id !== input.storeId || queueEntry.version !== input.version) return false
    const status = statuses.find(
      (item) =>
        item.id === queueEntry.id &&
        item.version === queueEntry.version &&
        (item.runId === queueEntry.runId || item.index === queueEntry.index),
    )
    return !status || status.status === 'pending' || status.status === 'running'
  })

  if (hasActiveStatus || hasActiveQueue) {
    return { queued: false as const, reason: 'already_queued' as const }
  }

  const runId = buildRunId(input.storeId, input.version)
  const entry: AgentQueueEntry = {
    id: input.storeId,
    name: input.name ?? undefined,
    version: input.version,
    index: Date.now(),
    runId,
    artifactRoot: getExtensionArtifactRoot(input.storeId, input.version),
    reason: input.reason,
    incoming_time: new Date().toISOString(),
  }

  queue.push(entry)
  writeJsonAtomic(queuePath, queue)
  return { queued: true as const, entry }
}

export function readAgentStatuses() {
  return readJsonArray<AgentStatusEntry>(getAgentStatusPath())
}

export function readAgentIncomingQueue() {
  return readJsonArray<AgentQueueEntry>(getAgentIncomingQueuePath())
}
