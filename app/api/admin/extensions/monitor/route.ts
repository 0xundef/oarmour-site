import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  return String(error ?? '')
}

function buildUpdateQuery(data: Record<string, boolean>, whereId: string) {
  const sets: string[] = []
  const values: any[] = []
  let paramIdx = 1
  for (const [col, val] of Object.entries(data)) {
    sets.push(`"${col}" = $${paramIdx}`)
    values.push(val)
    paramIdx++
  }
  values.push(whereId)
  return {
    sql: `UPDATE "GlobalExtension" SET ${sets.join(', ')} WHERE "id" = $${paramIdx}`,
    values,
  }
}

export async function POST(req: NextRequest) {
  try {
    const { id, storeId, isMonitored } = await req.json()
    const hasIsMonitored = typeof isMonitored === 'boolean'
    if (!hasIsMonitored) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }

    const updates: Record<string, boolean> = { isMonitored }

    if (id) {
      try {
        const { sql, values } = buildUpdateQuery(updates, id)
        await prisma.$executeRawUnsafe(sql, ...values)
        return NextResponse.json({ ok: true })
      } catch (e: unknown) {
        const msg = getErrorMessage(e)
        if (msg.includes('Record to update not found')) {
          return NextResponse.json({ error: 'Extension not found' }, { status: 404 })
        }
        if (msg.includes('column') && msg.includes('isMonitored')) {
          return NextResponse.json({ error: 'Monitoring columns not available. Run DB migration.' }, { status: 400 })
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
              platform: 'CHROME',
            },
            select: { id: true },
          })
          ext = created
        }
        const { sql, values } = buildUpdateQuery(updates, ext.id)
        await prisma.$executeRawUnsafe(sql, ...values)
        return NextResponse.json({ ok: true, id: ext.id })
      } catch (e: unknown) {
        const msg = getErrorMessage(e)
        if (msg.includes('column') && msg.includes('isMonitored')) {
          return NextResponse.json({ error: 'Monitoring columns not available. Run DB migration.' }, { status: 400 })
        }
        return NextResponse.json({ error: 'Upsert failed', message: msg }, { status: 500 })
      }
    } else {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
