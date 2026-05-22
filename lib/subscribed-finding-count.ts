import 'server-only'
import fs from 'fs'
import path from 'path'
import { prisma } from '@/lib/prisma'
import { normalizeApexDomain } from '@/lib/domain-normalize'
import { getExtensionAnalysisDir } from '@/lib/extension-storage'
import type { AiTestingLatestPayload } from '@/lib/ai-testing-display'
import { loadFindingResolutionsForUser, countOpenHighCriticalFindings } from '@/lib/finding-resolution-store'
import {
  countHighCriticalWorkbenchFindings,
  versionsAligned,
  type StaticLatestPayload,
} from '@/lib/workbench-check-items'
import {
  findLatestAiTestingPayload,
} from '@/lib/ai-testing-latest-loader'

function loadDomainSourceFilesByApex(storeId: string, version: string): Record<string, string[]> {
  const apexListPath = path.join(getExtensionAnalysisDir(storeId, version), 'apexdomain_list.json')
  if (!fs.existsSync(apexListPath)) return {}
  try {
    const raw = JSON.parse(fs.readFileSync(apexListPath, 'utf8')) as unknown
    if (!Array.isArray(raw)) return {}
    const map: Record<string, string[]> = {}
    for (const row of raw) {
      if (!row || typeof row !== 'object') continue
      const obj = row as Record<string, unknown>
      const apex = typeof obj.apexDomain === 'string' ? obj.apexDomain : ''
      const filesRaw = obj.sourceFiles
      if (!apex.trim()) continue
      const key = normalizeApexDomain(apex)
      const files = Array.isArray(filesRaw)
        ? filesRaw.filter((f): f is string => typeof f === 'string' && f.trim().length > 0)
        : []
      if (files.length > 0) map[key] = files
    }
    return map
  } catch {
    return {}
  }
}

function normalizeDomainString(value: string): string {
  return value.trim().toLowerCase().replace(/\.+$/, '')
}

function normalizeDomainList(values: string[]): string[] {
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
                return [normalizeDomainString(domain)]
              }
            }
          } catch {}
          return [normalizeDomainString(text)]
        })
        .filter((d) => d.length > 0),
    ),
  )
}

function parseManifestPermissions(raw: unknown): StaticLatestPayload['manifestPermissions'] {
  if (!raw || typeof raw !== 'object') {
    return { hostPermissions: [], optionalHostPermissions: [] }
  }
  const obj = raw as Record<string, unknown>
  const toArray = (value: unknown) =>
    Array.isArray(value) ? value.filter((x): x is string => typeof x === 'string') : []
  return {
    hostPermissions: toArray(obj.hostPermissions),
    optionalHostPermissions: toArray(obj.optionalHostPermissions),
  }
}

async function loadStaticLatestPayload(
  storeId: string,
  versionHint?: string | null,
): Promise<StaticLatestPayload | null> {
  const ext = await prisma.globalExtension.findUnique({
    where: { storeId },
    select: { id: true, version: true },
  })
  if (!ext) return null

  const versionSegment =
    (versionHint?.trim() || ext.version?.trim() || '') || ''
  if (!versionSegment) return null

  const latest = await prisma.extensionAnalysisResult.findFirst({
    where: {
      extensionId: ext.id,
      status: 'COMPLETED',
      version: versionSegment,
    },
    orderBy: { createdAt: 'desc' },
    select: { id: true, domains: true, updatedAt: true },
  })
  if (!latest) return null

  const previous = await prisma.extensionAnalysisResult.findFirst({
    where: {
      extensionId: ext.id,
      status: 'COMPLETED',
      version: { not: versionSegment },
    },
    orderBy: { createdAt: 'desc' },
    select: { domains: true },
  })

  const snapshot = await prisma.assetSnapshot.findFirst({
    where: { targetType: 'EXTENSION', targetId: ext.id, version: versionSegment },
    orderBy: { capturedAt: 'desc' },
    select: { metadata: true },
  })
  const snapshotMetadata =
    snapshot?.metadata && typeof snapshot.metadata === 'object'
      ? (snapshot.metadata as Record<string, unknown>)
      : null
  const manifestPermissions = parseManifestPermissions(snapshotMetadata?.manifestPermissions)

  const latestDomains = normalizeDomainList(latest.domains || [])
  const prevDomains = normalizeDomainList(previous?.domains || [])
  const prevDomainSet = new Set(prevDomains)
  const addedDomains = latestDomains.filter((d) => !prevDomainSet.has(d))

  const topEnrichments =
    addedDomains.length > 0
      ? await prisma.domainEnrichment.findMany({
          where: {
            analysisId: latest.id,
            createdDate: { not: null },
            domain: { in: addedDomains },
          },
          orderBy: { createdDate: 'desc' },
          take: 3,
          select: { id: true, domain: true, createdDate: true, isMalicious: true },
        })
      : []

  const sourceFilesByApex = loadDomainSourceFilesByApex(storeId, versionSegment)
  const topDomainSignals = topEnrichments.map((item) => {
    const apexKey = normalizeApexDomain(item.domain)
    return {
      topDomainSignalId: item.id,
      domain: item.domain,
      createTime: item.createdDate ? item.createdDate.toISOString() : null,
      isMalicious: typeof item.isMalicious === 'boolean' ? item.isMalicious : null,
      sourceFiles: sourceFilesByApex[apexKey] ?? [],
    }
  })

  return {
    extensionVersion: versionSegment,
    staticAnalyzedAt: latest.updatedAt.toISOString(),
    addedDomains,
    topDomainSignals,
    manifestPermissions,
  }
}

export async function countHighCriticalFindingsForSubscribed(
  storeId: string,
  versionHint?: string | null,
  userId?: string | null,
): Promise<number> {
  const staticPayload = await loadStaticLatestPayload(storeId, versionHint)
  const staticVersion =
    staticPayload?.extensionVersion?.trim() ||
    versionHint?.trim() ||
    ''

  let aiPayload: AiTestingLatestPayload | null = null
  if (staticVersion) {
    const candidate = await findLatestAiTestingPayload(storeId, staticVersion)
    if (candidate && versionsAligned(staticVersion, candidate.version ?? '')) {
      aiPayload = candidate
    }
  }

  const payloads = { staticPayload, aiPayload }
  if (!userId?.trim()) {
    return countHighCriticalWorkbenchFindings(payloads)
  }

  const resolutions = await loadFindingResolutionsForUser(userId.trim(), storeId)
  return countOpenHighCriticalFindings(payloads, resolutions)
}
