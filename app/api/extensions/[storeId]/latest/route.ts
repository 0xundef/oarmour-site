import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

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
    const latestDomains = latest.domains || []
    const latestIps = latest.ips || []
    const prevDomains = previous?.domains || []
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
      addedIps,
    })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
