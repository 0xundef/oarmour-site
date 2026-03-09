import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const { id, storeId, isMonitored } = await req.json()
    if (typeof isMonitored !== 'boolean') {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }
    // Allow toggle by DB id or by Chrome Web Store ID
    if (id) {
      try {
        await prisma.globalExtension.update({
          where: { id },
          data: { isMonitored },
        })
        return NextResponse.json({ ok: true })
      } catch (e: any) {
        const msg = String(e?.message ?? '')
        if (msg.includes('Record to update not found')) {
          return NextResponse.json({ error: 'Extension not found' }, { status: 404 })
        }
        if (msg.includes('column') && msg.includes('isMonitored')) {
          return NextResponse.json({ error: 'Monitoring flag not available. Run DB migration.' }, { status: 400 })
        }
        return NextResponse.json({ error: 'Update failed' }, { status: 500 })
      }
    } else if (storeId) {
      try {
        let ext = await prisma.globalExtension.findUnique({
          where: { storeId },
          select: { id: true },
        })
        if (!ext) {
          const created = await prisma.globalExtension.create({
            data: {
              storeId,
              name: storeId,
              platform: 'CHROME' as any,
            },
            select: { id: true },
          })
          ext = created
        }
        await prisma.$executeRawUnsafe(
          `UPDATE "GlobalExtension" SET "isMonitored" = $1 WHERE "id" = $2`,
          isMonitored,
          ext.id
        )
        return NextResponse.json({ ok: true, id: ext.id })
      } catch (e: any) {
        const msg = String(e?.message ?? '')
        if (msg.includes('column') && msg.includes('isMonitored')) {
          return NextResponse.json({ error: 'Monitoring flag not available. Run DB migration.' }, { status: 400 })
        }
        return NextResponse.json({ error: 'Upsert failed', message: msg }, { status: 500 })
      }
    } else {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }
  } catch (e) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
