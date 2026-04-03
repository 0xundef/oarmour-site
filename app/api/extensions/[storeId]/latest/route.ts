import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

type TopDomainSignal = {
  topDomainSignalId: string | null
  domain: string
  createTime: string | null
  isMalicious: boolean | null
}

type ManifestPermissionsPayload = {
  permissions: string[]
  hostPermissions: string[]
  optionalPermissions: string[]
  optionalHostPermissions: string[]
  allRequestedPermissions: string[]
}

type ManifestIconAssetsPayload = {
  hasDeclaredIcon: boolean
  hasPackagedIcon: boolean
  declaredIconPaths: string[]
  existingIconPaths: string[]
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
              if (typeof domain === 'string' && domain.trim()) return [normalizeDomainString(domain)]
            }
          } catch {}
          return [normalizeDomainString(text)]
        })
        .filter((d) => d.length > 0),
    ),
  )
}

function parseManifestPermissions(raw: unknown): ManifestPermissionsPayload {
  if (!raw || typeof raw !== 'object') {
    return {
      permissions: [],
      hostPermissions: [],
      optionalPermissions: [],
      optionalHostPermissions: [],
      allRequestedPermissions: [],
    }
  }
  const obj = raw as Record<string, unknown>
  const toArray = (value: unknown) => (Array.isArray(value) ? value.filter((x): x is string => typeof x === 'string') : [])
  return {
    permissions: toArray(obj.permissions),
    hostPermissions: toArray(obj.hostPermissions),
    optionalPermissions: toArray(obj.optionalPermissions),
    optionalHostPermissions: toArray(obj.optionalHostPermissions),
    allRequestedPermissions: toArray(obj.allRequestedPermissions),
  }
}

function parseManifestIconAssets(raw: unknown): ManifestIconAssetsPayload {
  if (!raw || typeof raw !== 'object') {
    return {
      hasDeclaredIcon: false,
      hasPackagedIcon: false,
      declaredIconPaths: [],
      existingIconPaths: [],
    }
  }
  const obj = raw as Record<string, unknown>
  const toArray = (value: unknown) => (Array.isArray(value) ? value.filter((x): x is string => typeof x === 'string') : [])
  return {
    hasDeclaredIcon: obj.hasDeclaredIcon === true,
    hasPackagedIcon: obj.hasPackagedIcon === true,
    declaredIconPaths: toArray(obj.declaredIconPaths),
    existingIconPaths: toArray(obj.existingIconPaths),
  }
}

function parseTopDomainSignal(raw: string): TopDomainSignal {
  try {
    const parsed: unknown = JSON.parse(raw)
    if (parsed && typeof parsed === 'object') {
      const obj = parsed as Record<string, unknown>
      const domain = typeof obj.domain === 'string' ? obj.domain : raw
      const topDomainSignalId = typeof obj.topDomainSignalId === 'string' ? obj.topDomainSignalId : null
      const createTime = typeof obj.createTime === 'string' ? obj.createTime : null
      const isMalicious = typeof obj.isMalicious === 'boolean' ? obj.isMalicious : null
      return { topDomainSignalId, domain, createTime, isMalicious }
    }
  } catch {}
  return { topDomainSignalId: null, domain: raw, createTime: null, isMalicious: null }
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ storeId: string }> }
) {
  const { storeId } = await context.params
  if (!storeId) {
    return NextResponse.json({ error: 'storeId required' }, { status: 400 })
  }
  try {
    const ext = await prisma.globalExtension.findUnique({
      where: { storeId },
      select: { id: true },
    })
    if (!ext) {
      return NextResponse.json({ error: 'Extension not found' }, { status: 404 })
    }
    const results = await prisma.extensionAnalysisResult.findMany({
      where: { extensionId: ext.id },
      orderBy: { createdAt: 'desc' },
      take: 2,
      select: { id: true, domains: true, ips: true, urls: true, filesScanned: true, status: true },
    })
    if (results.length === 0) {
      return NextResponse.json({ error: 'No analysis found' }, { status: 404 })
    }
    const latest = results[0]
    const previous = results[1]
    const snapshot = await prisma.assetSnapshot.findFirst({
      where: { targetType: 'EXTENSION', targetId: ext.id },
      orderBy: { capturedAt: 'desc' },
      select: { metadata: true },
    })
    const snapshotMetadata =
      snapshot?.metadata && typeof snapshot.metadata === 'object'
        ? (snapshot.metadata as Record<string, unknown>)
        : null
    const manifestPermissions = parseManifestPermissions(snapshotMetadata?.manifestPermissions)
    const manifestIconAssets = parseManifestIconAssets(snapshotMetadata?.manifestIconAssets)
    const latestDomains = normalizeDomainList(latest.domains || [])
    const latestIps = latest.ips || []
    const prevDomains = normalizeDomainList(previous?.domains || [])
    const prevIps = previous?.ips || []
    const prevDomainSet = new Set(prevDomains)
    const prevIpSet = new Set(prevIps)
    const addedDomains = latestDomains.filter((d) => !prevDomainSet.has(d))
    const addedIps = latestIps.filter((ip) => !prevIpSet.has(ip))
    const topEnrichments = addedDomains.length > 0
      ? await prisma.domainEnrichment.findMany({
        where: { analysisId: latest.id, createdDate: { not: null }, domain: { in: addedDomains } },
        orderBy: { createdDate: 'desc' },
        take: 3,
        select: { id: true, domain: true, createdDate: true, isMalicious: true },
      })
      : []
    const latestDomainSignals = topEnrichments.map((item) => ({
      topDomainSignalId: item.id,
      domain: item.domain,
      createTime: item.createdDate ? item.createdDate.toISOString() : null,
      isMalicious: typeof item.isMalicious === 'boolean' ? item.isMalicious : null,
    }))
    console.warn('[analysis] latestRoute:domainDiff', {
      storeId,
      latestAnalysisId: latest.id,
      previousAnalysisId: previous?.id ?? null,
      prev_domains: prevDomains.length,
      curr_domains: latestDomains.length,
      diff_domains: addedDomains.length,
    })
    return NextResponse.json({
      status: latest.status,
      filesScanned: latest.filesScanned,
      totalDomains: latestDomains.length,
      totalIps: latestIps.length,
      urls: latest.urls || [],
      addedDomains,
      topDomainSignals: latestDomainSignals,
      addedIps,
      manifestPermissions,
      manifestIconAssets,
    })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
