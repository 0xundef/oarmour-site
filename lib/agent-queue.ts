import fs from 'fs'
import path from 'path'
import { enqueueBrowserAgentTask } from '@/lib/browser-agent-task-queue'
import {
  getAgentCliConfigTemplatePath,
  getAgentDefaultPromptPath,
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

export async function enqueueAgentBrowserTestTask(input: {
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

  const result = await enqueueBrowserAgentTask({
    storeId: input.storeId,
    name: input.name,
    version: input.version,
    reason: input.reason,
  })
  if (!result.queued) {
    return result
  }

  const entry: AgentQueueEntry = {
    id: input.storeId,
    name: input.name ?? undefined,
    version: input.version,
    index: Date.now(),
    runId: result.sessionId,
    artifactRoot: getExtensionArtifactRoot(input.storeId, input.version),
    reason: input.reason,
    incoming_time: new Date().toISOString(),
  }
  return { queued: true as const, entry }
}

export function readAgentStatuses() {
  return readJsonArray<AgentStatusEntry>(getAgentStatusPath())
}
