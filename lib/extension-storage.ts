import os from 'os'
import path from 'path'

const ANALYZER_STORAGE_DIR = 'chrome-extension-analyzer'

function getStorageBaseDir() {
  const configured = process.env.EXTENSION_STORAGE_ROOT?.trim()
  return configured ? path.resolve(configured) : os.tmpdir()
}

export function getExtensionAnalyzerRoot() {
  return path.join(getStorageBaseDir(), ANALYZER_STORAGE_DIR)
}
