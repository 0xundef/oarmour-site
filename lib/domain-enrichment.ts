import { prisma } from '@/lib/prisma'
import { rdapDomain, whoisInfo, vtGetDomain } from '@/lib/threat-intel'
import type { RiskLevel } from '@prisma/client'

export type DomainEnrichmentRow = {
  domain: string
  registrar: string | null
  status: string | null
  nameservers: string[]
  createdDate: Date | null
  expiresDate: Date | null
  isMalicious?: boolean | null
}

const readPositiveIntEnv = (name: string, fallback: number) => {
  const raw = Number(process.env[name] ?? '')
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : fallback
}

const DOMAIN_ENRICH_CONCURRENCY = readPositiveIntEnv('ANALYSIS_DOMAIN_ENRICH_CONCURRENCY', 6)

const mapWithConcurrency = async <T, R>(
  items: T[],
  limit: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> => {
  const safeLimit = Math.max(1, Math.floor(limit))
  const results = new Array<R>(items.length)
  let cursor = 0
  const workers = Array.from({ length: Math.min(safeLimit, items.length) }, async () => {
    while (true) {
      const current = cursor++
      if (current >= items.length) return
      results[current] = await mapper(items[current], current)
    }
  })
  await Promise.all(workers)
  return results
}

export function isDomainMalicious(vt: unknown): boolean {
  if (!vt || typeof vt !== 'object') return false
  const data = (vt as { data?: unknown }).data
  if (!data || typeof data !== 'object') return false
  const attributes = (data as { attributes?: unknown }).attributes
  if (!attributes || typeof attributes !== 'object') return false
  const stats = (attributes as { last_analysis_stats?: unknown }).last_analysis_stats
  if (!stats || typeof stats !== 'object') return false
  const malicious = (stats as { malicious?: unknown }).malicious
  return typeof malicious === 'number' && malicious > 0
}

export async function enrichApexDomains(domains: string[]): Promise<DomainEnrichmentRow[]> {
  if (domains.length === 0) return []
  return mapWithConcurrency(domains, DOMAIN_ENRICH_CONCURRENCY, async (d) => {
    let registrar: string | null = null
    let status: string | null = null
    let nameservers: string[] = []
    let createdDate: Date | null = null
    let expiresDate: Date | null = null
    try {
      const info = await rdapDomain(d)
      registrar = info.registrar ?? null
      status = info.status ?? null
      nameservers = Array.isArray(info.nameservers) ? info.nameservers : []
      createdDate = info.createdDate ?? null
      expiresDate = info.expiresDate ?? null
    } catch {
      // RDAP optional
    }
    const tld = d.split('.').pop()?.toLowerCase()
    const hasCreatedDate =
      createdDate instanceof Date && !Number.isNaN(createdDate.getTime())
    if (tld !== 'dev' && !hasCreatedDate) {
      try {
        const w = await whoisInfo(d)
        registrar = registrar ?? w.registrar
        nameservers = nameservers.length ? nameservers : w.nameservers
        createdDate = createdDate ?? w.createdDate
        expiresDate = expiresDate ?? w.expiresDate
      } catch {
        // WHOIS optional
      }
    }
    return {
      domain: d,
      registrar,
      status,
      nameservers,
      createdDate,
      expiresDate,
    }
  })
}

export type VtDomainSignal = {
  domain: string
  createTime: string | null
  isMalicious: boolean
}

export async function vtSignalsForYoungestDomains(
  domains: string[],
  enrichmentByDomain: Map<string, DomainEnrichmentRow>,
  limit = 3,
): Promise<VtDomainSignal[]> {
  const topYoung = domains
    .map((domain) => {
      const enrichment = enrichmentByDomain.get(domain) ?? null
      return { domain, createdDate: enrichment?.createdDate ?? null }
    })
    .filter((item): item is { domain: string; createdDate: Date } =>
      !!item.createdDate && !Number.isNaN(item.createdDate.getTime()),
    )
    .sort((a, b) => b.createdDate.getTime() - a.createdDate.getTime())
    .slice(0, limit)

  return Promise.all(
    topYoung.map(async (item) => {
      let isMalicious = false
      try {
        const vt = await vtGetDomain(item.domain)
        isMalicious = isDomainMalicious(vt)
      } catch {
        // VT optional
      }
      return {
        domain: item.domain,
        createTime: item.createdDate.toISOString(),
        isMalicious,
      }
    }),
  )
}

export async function persistStaticDomainEnrichments(
  analysisId: string,
  rows: Array<DomainEnrichmentRow & { analysisId: string }>,
) {
  if (rows.length === 0) return
  await prisma.domainEnrichment.createMany({ data: rows })
}

export async function persistAiDomainEnrichments(
  analysisId: string,
  rows: DomainEnrichmentRow[],
) {
  if (rows.length === 0) return
  await prisma.aiDomainEnrichment.createMany({
    data: rows.map((row) => ({
      analysisId,
      domain: row.domain,
      registrar: row.registrar,
      status: row.status,
      nameservers: row.nameservers,
      createdDate: row.createdDate,
      expiresDate: row.expiresDate,
      isMalicious: row.isMalicious ?? null,
    })),
  })
}

export async function applyVtToStaticDomains(
  analysisId: string,
  signals: VtDomainSignal[],
) {
  for (const signal of signals) {
    await prisma.domainEnrichment.updateMany({
      where: { analysisId, domain: signal.domain },
      data: { isMalicious: signal.isMalicious },
    })
  }
}

export async function applyVtToAiDomains(analysisId: string, signals: VtDomainSignal[]) {
  for (const signal of signals) {
    await prisma.aiDomainEnrichment.updateMany({
      where: { analysisId, domain: signal.domain },
      data: { isMalicious: signal.isMalicious },
    })
  }
}

export function riskLevelFromVtSignals(signals: VtDomainSignal[]): RiskLevel {
  return signals.some((s) => s.isMalicious) ? 'HIGH' : 'SAFE'
}
