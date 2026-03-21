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
      select: { domains: true, ips: true, urls: true, filesScanned: true, status: true },
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
    const latestDomainSignals = (latest.domains || []).map(parseTopDomainSignal)
    const latestDomains = latestDomainSignals.map((d) => d.domain)
    const latestIps = latest.ips || []
    const prevDomains = (previous?.domains || []).map((x) => parseTopDomainSignal(x).domain)
    const prevIps = previous?.ips || []
    const prevDomainSet = new Set(prevDomains)
    const prevIpSet = new Set(prevIps)
    const addedDomains = latestDomains.filter((d) => !prevDomainSet.has(d))
    const addedIps = latestIps.filter((ip) => !prevIpSet.has(ip))
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
    })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
