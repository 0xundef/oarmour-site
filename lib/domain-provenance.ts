import { apexFromUrlOrHost, normalizeApexDomain } from '@/lib/domain-normalize'

export type DomainExtractionSourceKind = 'extension_file' | 'network_request'

/** One observed hostname at a concrete source location. */
export type DomainExtractionHit = {
  host: string
  apex: string
  sourceKind: DomainExtractionSourceKind
  /** Relative extension file path, or e.g. `network.json` for runtime capture. */
  sourcePath: string
  /** Full request URL when extracted from network traffic. */
  requestUrl?: string
}

export type DomainSourceRecord = {
  kind: DomainExtractionSourceKind
  path: string
  host: string
  url?: string
}

export type ApexDomainProvenance = {
  apexDomain: string
  observedHosts: string[]
  sourceFiles: string[]
  sources: DomainSourceRecord[]
}

type ProvenanceAccumulator = {
  apexDomain: string
  observedHosts: Set<string>
  sourceFiles: Set<string>
  sources: Map<string, DomainSourceRecord>
}

function sourceRecordKey(record: DomainSourceRecord): string {
  return `${record.kind}|${record.path}|${record.host}|${record.url ?? ''}`
}

export function recordDomainExtractionHit(
  store: Map<string, ProvenanceAccumulator>,
  hit: DomainExtractionHit,
): void {
  const apex = normalizeApexDomain(hit.apex)
  const host = normalizeApexDomain(hit.host)
  if (!apex || !host) return

  const sourcePath = hit.sourcePath.replace(/\\/g, '/').trim()
  if (!sourcePath) return

  let acc = store.get(apex)
  if (!acc) {
    acc = {
      apexDomain: apex,
      observedHosts: new Set(),
      sourceFiles: new Set(),
      sources: new Map(),
    }
    store.set(apex, acc)
  }

  acc.observedHosts.add(host)
  acc.sourceFiles.add(sourcePath)

  const record: DomainSourceRecord = {
    kind: hit.sourceKind,
    path: sourcePath,
    host,
    ...(hit.requestUrl ? { url: hit.requestUrl } : {}),
  }
  acc.sources.set(sourceRecordKey(record), record)
}

export function buildApexDomainProvenanceList(
  store: Map<string, ProvenanceAccumulator>,
): ApexDomainProvenance[] {
  return Array.from(store.values())
    .map((acc) => ({
      apexDomain: acc.apexDomain,
      observedHosts: Array.from(acc.observedHosts).sort((a, b) => a.localeCompare(b)),
      sourceFiles: Array.from(acc.sourceFiles).sort((a, b) => a.localeCompare(b)),
      sources: Array.from(acc.sources.values()).sort((a, b) => {
        const byPath = a.path.localeCompare(b.path)
        if (byPath !== 0) return byPath
        return a.host.localeCompare(b.host)
      }),
    }))
    .sort((a, b) => a.apexDomain.localeCompare(b.apexDomain))
}

export function provenanceMapFromList(
  list: ApexDomainProvenance[],
): Map<string, ApexDomainProvenance> {
  return new Map(list.map((item) => [item.apexDomain, item]))
}

/** Register a URL/host observation into the provenance store. */
export function recordUrlOrHostObservation(params: {
  store: Map<string, ProvenanceAccumulator>
  input: string
  sourceKind: DomainExtractionSourceKind
  sourcePath: string
  requestUrl?: string
}): string | null {
  const text = params.input.trim()
  if (!text) return null

  let host: string | null = null
  try {
    const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(text) ? text : `https://${text}`
    host = new URL(withScheme).hostname.toLowerCase()
  } catch {
    host = text.replace(/^[*]+\./, '').split('/')[0]?.toLowerCase() || null
  }
  if (!host) return null

  const apex = apexFromUrlOrHost(host) || apexFromUrlOrHost(text)
  if (!apex) return null

  recordDomainExtractionHit(params.store, {
    host,
    apex,
    sourceKind: params.sourceKind,
    sourcePath: params.sourcePath,
    requestUrl: params.requestUrl,
  })
  return apex
}

export type ProvenanceStore = Map<string, ProvenanceAccumulator>

export function createProvenanceStore(): ProvenanceStore {
  return new Map()
}

/** Parse Chrome extension host permission / match patterns into a hostname. */
export function hostFromChromeMatchPattern(pattern: string): string | null {
  const p = pattern.trim()
  if (!p) return null
  const match = p.match(/^(?:[a-z*]+):\/\/(?:\*\.|)([^/*:]+)/i)
  if (match?.[1]) return match[1].toLowerCase()
  if (!p.includes('://') && !p.includes('/')) return p.toLowerCase()
  return null
}

export function recordManifestHostPermissionPatterns(params: {
  store: ProvenanceStore
  patterns: string[]
  manifestPath: string
}): void {
  const manifestPath = params.manifestPath.replace(/\\/g, '/').trim()
  if (!manifestPath) return
  for (const pattern of params.patterns) {
    const host = hostFromChromeMatchPattern(pattern)
    if (!host) continue
    recordUrlOrHostObservation({
      store: params.store,
      input: `https://${host}/`,
      sourceKind: 'extension_file',
      sourcePath: manifestPath,
      requestUrl: pattern,
    })
  }
}
