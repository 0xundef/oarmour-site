import type { AiTestingNetworkLog, AiTestingNetworkRequest } from '@/lib/ai-testing-network'
import { apexFromUrlOrHost, normalizeApexDomainList } from '@/lib/domain-normalize'

const STATIC_ASSET_RE = /\.(js|mjs|css|png|jpe?g|gif|svg|webp|woff2?|ttf|ico|map|wasm)(\?|$)/i

const RUNTIME_NOISE_HOST_RE =
  /(^|\.)sentry\.io$|(^|\.)ingest\.sentry\.io$|(^|\.)cdn\.contentful\.com$/i

function shouldIncludeNetworkRequest(req: AiTestingNetworkRequest): boolean {
  const url = req.url.trim()
  if (!url) return false
  const lower = url.toLowerCase()
  if (lower.startsWith('chrome-extension://') || lower.startsWith('moz-extension://')) {
    return false
  }
  if (STATIC_ASSET_RE.test(lower)) return false
  if (req.resourceType && !['fetch', 'xhr', 'websocket'].includes(req.resourceType)) {
    return false
  }
  try {
    const host = new URL(url).hostname.toLowerCase()
    if (RUNTIME_NOISE_HOST_RE.test(host)) return false
  } catch {
    return false
  }
  return true
}

export function extractRuntimeApexDomainsFromNetwork(log: AiTestingNetworkLog): string[] {
  const hosts = new Set<string>()
  for (const req of log.requests) {
    if (!shouldIncludeNetworkRequest(req)) continue
    const apex = apexFromUrlOrHost(req.url)
    if (apex) hosts.add(apex)
  }
  return normalizeApexDomainList(hosts)
}
