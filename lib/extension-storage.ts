import fs from 'fs'
import os from 'os'
import path from 'path'

const ANALYZER_STORAGE_DIR = 'chrome-extension-analyzer'
const AGENT_QUEUE_DIR = 'agent-queue'
/** Sidecar under `AGENT_QUEUE_ROOT`: analysis outputs, `ai_testing/`, `cli_config.json` (not the unpacked extension tree). */
export const EXTENSION_SIDE_DATA_DIRNAME = 'extension-data'

export function getExtensionStorageBaseDir() {
  const configured = process.env.EXTENSION_STORAGE_ROOT?.trim()
  return configured ? path.resolve(configured) : os.tmpdir()
}

export function getExtensionAnalyzerRoot() {
  return path.join(getExtensionStorageBaseDir(), ANALYZER_STORAGE_DIR)
}

/** Unpacked extension only: `EXTENSION_STORAGE_ROOT/chrome-extension-analyzer/<storeId>/<version>`. */
export function getExtensionArtifactRoot(storeId: string, version: string) {
  return path.join(getExtensionAnalyzerRoot(), storeId, version)
}

/**
 * Per-version sidecar: `AGENT_QUEUE_ROOT/extension-data/<storeId>/<version>/`.
 * Holds `cli_config.json`, `analysis/`, `ai_testing/` so the unpack dir stays pure source.
 */
export function getExtensionSidecarRoot(storeId: string, version: string) {
  return path.join(getAgentQueueRoot(), EXTENSION_SIDE_DATA_DIRNAME, storeId, version)
}

export function getExtensionAnalysisDir(storeId: string, version: string) {
  return path.join(getExtensionSidecarRoot(storeId, version), 'analysis')
}

/** If `unpackDir` is `.../chrome-extension-analyzer/<storeId>/<version>`, return ids; else null. */
export function parseExtensionUnpackPath(unpackDir: string): { storeId: string; version: string } | null {
  const abs = path.resolve(unpackDir)
  const version = path.basename(abs)
  const storeId = path.basename(path.dirname(abs))
  const analyzerSegment = path.basename(path.dirname(path.dirname(abs)))
  if (!version || !storeId || analyzerSegment !== ANALYZER_STORAGE_DIR) return null
  return { storeId, version }
}

/** Extension-specific override: `AGENT_QUEUE_ROOT/extension-data/<storeId>/prompt.md` */
export function getExtensionScopedPromptPath(storeId: string): string {
  return path.join(getAgentQueueRoot(), EXTENSION_SIDE_DATA_DIRNAME, storeId, 'prompt.md')
}

/** Shared default when no extension prompt: `AGENT_QUEUE_ROOT/prompt.md` */
export function getAgentDefaultPromptPath(): string {
  return path.join(getAgentQueueRoot(), 'prompt.md')
}

/** True if either extension-level or (after sync) queue-level default prompt exists. */
export function hasResolvableAgentPrompt(storeId: string): boolean {
  return (
    fs.existsSync(getExtensionScopedPromptPath(storeId)) ||
    fs.existsSync(getAgentDefaultPromptPath())
  )
}

export function getAiTestingRoot(storeId: string, version: string) {
  return path.join(getExtensionSidecarRoot(storeId, version), 'ai_testing')
}

export function getAiTestingRunRoot(storeId: string, version: string, runId: string) {
  return path.join(getAiTestingRoot(storeId, version), runId)
}

export function getAgentQueueRoot() {
  const configured = process.env.AGENT_QUEUE_ROOT?.trim()
  return configured ? path.resolve(configured) : path.join(getExtensionStorageBaseDir(), AGENT_QUEUE_DIR)
}

export function getAgentIncomingQueuePath() {
  return path.join(getAgentQueueRoot(), 'incoming_queue.json')
}

export function getAgentStatusPath() {
  return path.join(getAgentQueueRoot(), 'status.json')
}

/** Template with `{{EXTENSION_ROOT}}` / `{{USER_DATA_DIR}}` placeholders; copied to queue root if missing. */
export function getAgentCliConfigTemplatePath() {
  return path.join(getAgentQueueRoot(), 'cli_config_template.json')
}

const AGENT_QUEUE_WHITELIST_BASENAME = 'whitelist'

const AGENT_QUEUE_WHITELIST_DEFAULT = `# AI browser test — Chrome Web Store extension ids (one per line).
# Lines starting with # are ignored. Only listed ids are enqueued to browseragent.
nkbihfbeogaeaoehlefnkodbefgpgknn
`

/**
 * Ensures `AGENT_QUEUE_ROOT/whitelist` exists (creates parent dirs and a default template with MetaMask if missing).
 * Call from app startup (e.g. instrumentation).
 */
export function ensureAgentQueueWhitelistFile(): void {
  const p = getAgentQueueWhitelistPath()
  const dir = path.dirname(p)
  fs.mkdirSync(dir, { recursive: true })
  if (!fs.existsSync(p)) {
    fs.writeFileSync(p, AGENT_QUEUE_WHITELIST_DEFAULT, 'utf8')
  }
}

/**
 * Text file: one Chrome Web Store extension id per line; `#` starts a comment; blank lines ignored.
 * Default: `AGENT_QUEUE_ROOT/whitelist`.
 * Override with `WHITELIST_FILE` (absolute path, or relative to `process.cwd()`).
 */
export function getAgentQueueWhitelistPath(): string {
  const fromEnv = process.env.WHITELIST_FILE?.trim()
  if (fromEnv) {
    return path.isAbsolute(fromEnv) ? fromEnv : path.resolve(process.cwd(), fromEnv)
  }
  return path.join(getAgentQueueRoot(), AGENT_QUEUE_WHITELIST_BASENAME)
}

/**
 * Allowed store ids from the whitelist file. Missing file → empty set (nothing enqueued until
 * `ensureAgentQueueWhitelistFile` has run or the file is created).
 */
export function loadAgentQueueWhitelistForEnqueue(): Set<string> {
  const p = getAgentQueueWhitelistPath()
  if (!fs.existsSync(p)) return new Set()
  const raw = fs.readFileSync(p, 'utf8')
  const ids = new Set<string>()
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    ids.add(t)
  }
  return ids
}
