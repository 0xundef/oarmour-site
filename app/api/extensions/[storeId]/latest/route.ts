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
    const latest = await prisma.extensionAnalysisResult.findFirst({
      where: { extensionId: ext.id },
      orderBy: { createdAt: 'desc' },
      select: { domains: true, ips: true, urls: true, filesScanned: true, status: true },
    })
    if (!latest) {
      return NextResponse.json({ error: 'No analysis found' }, { status: 404 })
    }
    return NextResponse.json(latest)
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
