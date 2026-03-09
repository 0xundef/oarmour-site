import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const { id, isMonitored } = await req.json()
    if (!id || typeof isMonitored !== 'boolean') {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }
    try {
      await (prisma as any).globalExtension.update({
        where: { id },
        data: { isMonitored },
      })
    } catch (e) {
      // Column might not exist yet in dev environments
      return NextResponse.json({ error: 'Monitoring flag not available. Run DB migration.' }, { status: 400 })
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
