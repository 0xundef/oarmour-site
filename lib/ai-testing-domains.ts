import type { AiTestingNetworkLog, AiTestingNetworkRequest } from '@/lib/ai-testing-network'
import { apexFromUrlOrHost, normalizeApexDomainList } from '@/lib/domain-normalize'
import {
  buildApexDomainProvenanceList,
  createProvenanceStore,
  recordUrlOrHostObservation,
  type ApexDomainProvenance,
  type ProvenanceStore,
} from '@/lib/domain-provenance'

const STATIC_ASSET_RE = /\.(js|mjs|css|png|jpe?g|gif|svg|webp|woff2?|ttf|ico|map|wasm)(\?|$)/i

const RUNTIME_NOISE_HOST_RE =
  /(^|\.)sentry\.io$|(^|\.)ingest\.sentry\.io$|(^|\.)cdn\.contentful\.com$/i

const NETWORK_LOG_SOURCE = 'network.json'

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

export function extractRuntimeApexDomainsWithProvenance(log: AiTestingNetworkLog): {
  domains: string[]
  provenance: ApexDomainProvenance[]
  store: ProvenanceStore
} {
  const store = createProvenanceStore()
  for (const req of log.requests) {
    if (!shouldIncludeNetworkRequest(req)) continue
    recordUrlOrHostObservation({
      store,
      input: req.url,
      sourceKind: 'network_request',
      sourcePath: NETWORK_LOG_SOURCE,
      requestUrl: req.url,
    })
  }
  const domains = normalizeApexDomainList(store.keys())
  return {
    domains,
    provenance: buildApexDomainProvenanceList(store),
    store,
  }
}

export function extractRuntimeApexDomainsFromNetwork(log: AiTestingNetworkLog): string[] {
  return extractRuntimeApexDomainsWithProvenance(log).domains
}
