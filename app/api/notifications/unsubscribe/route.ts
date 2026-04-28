import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'
const notificationSubscriptionModel = (prisma as unknown as {
  notificationSubscription?: {
    deleteMany: (...args: unknown[]) => Promise<unknown>
  }
}).notificationSubscription

type TokenPayload = {
  userId: string
  extensionId: string
  issuedAt: number
}

function parseToken(token: string): TokenPayload | null {
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf8')
    const [userId, extensionId, issuedAtRaw] = decoded.split(':')
    const issuedAt = Number(issuedAtRaw)
    if (!userId || !extensionId || !Number.isFinite(issuedAt)) return null
    return { userId, extensionId, issuedAt }
  } catch {
    return null
  }
}

async function resolveCandidateExtensionIds(inputExtensionId: string): Promise<string[]> {
  const extension = await prisma.globalExtension.findFirst({
    where: {
      OR: [{ id: inputExtensionId }, { storeId: inputExtensionId }],
    },
    select: { id: true },
  })

  if (extension?.id) {
    return Array.from(new Set([inputExtensionId, extension.id]))
  }
  return [inputExtensionId]
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')?.trim()
  if (!token) {
    return NextResponse.json({ error: 'Missing token' }, { status: 400 })
  }

  const payload = parseToken(token)
  if (!payload) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 400 })
  }

  try {
    if (!notificationSubscriptionModel) {
      const redirectUrl = new URL('/dashboard?notifications_unsubscribed=1', req.url)
      return NextResponse.redirect(redirectUrl)
    }
    const extensionIds = await resolveCandidateExtensionIds(payload.extensionId)
    await notificationSubscriptionModel.deleteMany({
      where: {
        userId: payload.userId,
        extensionId: { in: extensionIds },
      },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: 'Failed to unsubscribe', details: msg }, { status: 500 })
  }

  const redirectUrl = new URL('/dashboard?notifications_unsubscribed=1', req.url)
  return NextResponse.redirect(redirectUrl)
}
