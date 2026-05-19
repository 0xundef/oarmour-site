import { getDomain } from 'tldts'

export function normalizeApexDomain(value: string): string {
  return value.trim().toLowerCase().replace(/\.+$/, '')
}

export function apexFromUrlOrHost(input: string): string | null {
  const text = input.trim()
  if (!text) return null
  try {
    const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(text) ? text : `https://${text}`
    const host = new URL(withScheme).hostname
    const apex = getDomain(host) || getDomain(text)
    if (!apex) return null
    const normalized = normalizeApexDomain(apex)
    return normalized.length > 0 ? normalized : null
  } catch {
    const apex = getDomain(text)
    if (!apex) return null
    const normalized = normalizeApexDomain(apex)
    return normalized.length > 0 ? normalized : null
  }
}

/** Normalize heterogeneous stored domain rows (plain apex or JSON blobs). */
export function normalizeStoredDomainList(values: string[]): string[] {
  return Array.from(
    new Set(
      values
        .flatMap((raw) => {
          if (typeof raw !== 'string') return []
          const text = raw.trim()
          if (!text) return []
          try {
            const parsed: unknown = JSON.parse(text)
            if (parsed && typeof parsed === 'object') {
              const domain = (parsed as Record<string, unknown>).domain
              if (typeof domain === 'string' && domain.trim()) {
                return [normalizeApexDomain(domain)]
              }
            }
          } catch {
            // plain domain string
          }
          return [normalizeApexDomain(text)]
        })
        .filter((d) => d.length > 0),
    ),
  ).sort((a, b) => a.localeCompare(b))
}

export function normalizeApexDomainList(values: Iterable<string>): string[] {
  return Array.from(
    new Set(
      Array.from(values)
        .map((d) => normalizeApexDomain(String(d)))
        .filter((d) => d.length > 0),
    ),
  ).sort((a, b) => a.localeCompare(b))
}

export function diffNovelApexDomains(runtime: string[], staticDomains: string[]): string[] {
  const staticSet = new Set(normalizeApexDomainList(staticDomains))
  return normalizeApexDomainList(runtime).filter((d) => !staticSet.has(d))
}
