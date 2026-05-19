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

/** Lists runs under `extension-data/<storeId>/<version>/ai_testing/` that have `recordings.json`. */
export function listAiTestingRunsWithRecordings(
  storeId: string,
  version?: string,
): Array<{ version: string; runId: string; runRoot: string; mtimeMs: number }> {
  const storeDir = path.join(getAgentQueueRoot(), EXTENSION_SIDE_DATA_DIRNAME, storeId)
  if (!fs.existsSync(storeDir)) return []

  const versionDirs = version
    ? [path.join(storeDir, version)]
    : fs
        .readdirSync(storeDir, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => path.join(storeDir, entry.name))

  const runs: Array<{ version: string; runId: string; runRoot: string; mtimeMs: number }> = []

  for (const versionDir of versionDirs) {
    if (!fs.existsSync(versionDir)) continue
    const resolvedVersion = path.basename(versionDir)
    const aiTestingRoot = path.join(versionDir, 'ai_testing')
    if (!fs.existsSync(aiTestingRoot)) continue

    for (const entry of fs.readdirSync(aiTestingRoot, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue
      const runRoot = path.join(aiTestingRoot, entry.name)
      const recordingsPath = path.join(runRoot, 'recordings.json')
      if (!fs.existsSync(recordingsPath)) continue
      runs.push({
        version: resolvedVersion,
        runId: entry.name,
        runRoot,
        mtimeMs: fs.statSync(runRoot).mtimeMs,
      })
    }
  }

  return runs.sort((a, b) => b.mtimeMs - a.mtimeMs)
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


