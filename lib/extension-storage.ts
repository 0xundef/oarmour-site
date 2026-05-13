import fs from 'fs'
import os from 'os'
import path from 'path'

const ANALYZER_STORAGE_DIR = 'chrome-extension-analyzer'
const AGENT_QUEUE_DIR = 'agent-queue'

export function getExtensionStorageBaseDir() {
  const configured = process.env.EXTENSION_STORAGE_ROOT?.trim()
  return configured ? path.resolve(configured) : os.tmpdir()
}

export function getExtensionAnalyzerRoot() {
  return path.join(getExtensionStorageBaseDir(), ANALYZER_STORAGE_DIR)
}

export function getExtensionArtifactRoot(storeId: string, version: string) {
  return path.join(getExtensionAnalyzerRoot(), storeId, version)
}

/** Extension-specific override: `chrome-extension-analyzer/<storeId>/prompt.md` */
export function getExtensionScopedPromptPath(storeId: string): string {
  return path.join(getExtensionAnalyzerRoot(), storeId, 'prompt.md')
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
  return path.join(getExtensionArtifactRoot(storeId, version), 'ai_testing')
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
