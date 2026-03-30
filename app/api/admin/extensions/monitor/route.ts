import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  return String(error ?? '')
}

export async function POST(req: NextRequest) {
  try {
    const { id, storeId, isMonitored, testingMode } = await req.json()
    const hasIsMonitored = typeof isMonitored === 'boolean'
    const hasTestingMode = typeof testingMode === 'boolean'
    if (!hasIsMonitored && !hasTestingMode) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }
    if (id) {
      try {
        if (hasIsMonitored && hasTestingMode) {
          await prisma.$executeRawUnsafe(
            `UPDATE "GlobalExtension" SET "isMonitored" = $1, "testingMode" = $2 WHERE "id" = $3`,
            isMonitored,
            testingMode,
            id
          )
        } else if (hasIsMonitored) {
          await prisma.$executeRawUnsafe(
            `UPDATE "GlobalExtension" SET "isMonitored" = $1 WHERE "id" = $2`,
            isMonitored,
            id
          )
        } else if (hasTestingMode) {
          await prisma.$executeRawUnsafe(
            `UPDATE "GlobalExtension" SET "testingMode" = $1 WHERE "id" = $2`,
            testingMode,
            id
          )
        }
        return NextResponse.json({ ok: true })
      } catch (e: unknown) {
        const msg = getErrorMessage(e)
        if (msg.includes('Record to update not found')) {
          return NextResponse.json({ error: 'Extension not found' }, { status: 404 })
        }
        if (msg.includes('column') && (msg.includes('isMonitored') || msg.includes('testingMode'))) {
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
        if (hasIsMonitored && hasTestingMode) {
          await prisma.$executeRawUnsafe(
            `UPDATE "GlobalExtension" SET "isMonitored" = $1, "testingMode" = $2 WHERE "id" = $3`,
            isMonitored,
            testingMode,
            ext.id
          )
        } else if (hasIsMonitored) {
          await prisma.$executeRawUnsafe(
            `UPDATE "GlobalExtension" SET "isMonitored" = $1 WHERE "id" = $2`,
            isMonitored,
            ext.id
          )
        } else if (hasTestingMode) {
          await prisma.$executeRawUnsafe(
            `UPDATE "GlobalExtension" SET "testingMode" = $1 WHERE "id" = $2`,
            testingMode,
            ext.id
          )
        }
        return NextResponse.json({ ok: true, id: ext.id })
      } catch (e: unknown) {
        const msg = getErrorMessage(e)
        if (msg.includes('column') && (msg.includes('isMonitored') || msg.includes('testingMode'))) {
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
