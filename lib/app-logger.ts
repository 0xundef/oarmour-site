/** ISO-prefixed logs for server-side business flows (analysis, monitor, notifications, etc.). */

export const nowIso = () => new Date().toISOString()

function formatPrefix(message: string) {
  return `${nowIso()} ${message}`
}

export function logInfo(message: string, payload?: unknown) {
  if (typeof payload === 'undefined') {
    console.info(formatPrefix(message))
    return
  }
  console.info(formatPrefix(message), payload)
}

export function logWarn(message: string, payload?: unknown) {
  if (typeof payload === 'undefined') {
    console.warn(formatPrefix(message))
    return
  }
  console.warn(formatPrefix(message), payload)
}

export function logError(message: string, payload?: unknown) {
  if (typeof payload === 'undefined') {
    console.error(formatPrefix(message))
    return
  }
  console.error(formatPrefix(message), payload)
}
