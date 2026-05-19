import fs from 'fs'
import path from 'path'
import {
  getExtensionScopedPromptPath,
  getAgentDefaultPromptPath,
} from '@/lib/extension-storage'

const BUNDLED_DEFAULT_PROMPT_REL = ['lib', 'agent-queue', 'default-extension-test-prompt.md'] as const

function readBundledDefaultPrompt(): string {
  const src = path.join(process.cwd(), ...BUNDLED_DEFAULT_PROMPT_REL)
  if (!fs.existsSync(src)) return ''
  return fs.readFileSync(src, 'utf8')
}

/** DB value, then per-extension `prompt.md`, then queue default, then bundled template. */
export function resolveExtensionPromptMarkdown(
  storeId: string,
  dbValue?: string | null,
): string {
  if (typeof dbValue === 'string' && dbValue.trim()) return dbValue
  const scoped = getExtensionScopedPromptPath(storeId)
  if (fs.existsSync(scoped)) return fs.readFileSync(scoped, 'utf8')
  const globalDefault = getAgentDefaultPromptPath()
  if (fs.existsSync(globalDefault)) return fs.readFileSync(globalDefault, 'utf8')
  return readBundledDefaultPrompt()
}

/** Writes `AGENT_QUEUE_ROOT/extension-data/<storeId>/prompt.md` for browseragent. */
export function syncExtensionPromptFile(storeId: string, markdown: string): void {
  const dest = getExtensionScopedPromptPath(storeId)
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  const body = markdown.trimEnd()
  fs.writeFileSync(dest, body ? `${body}\n` : '', 'utf8')
}
