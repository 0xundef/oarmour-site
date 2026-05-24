/**
 * Normalizes `recordings.json` image paths for asset URLs.
 * Agent cwd is the extension sidecar; screenshots are stored under
 * `ai_testing/<runId>/` but the API asset route is already rooted at that folder.
 */
export function normalizeAiTestingImageRelativePath(image: string): string {
  let normalized = image.replace(/^\/+/, '')
  const redundantPrefix = /^ai_testing\/[^/]+\/(.+)$/.exec(normalized)
  if (redundantPrefix) {
    normalized = redundantPrefix[1]
  }
  return normalized
}
