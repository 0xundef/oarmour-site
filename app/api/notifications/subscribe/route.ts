import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'
const notificationSubscriptionModel = (prisma as unknown as {
  notificationSubscription?: {
    findUnique: (...args: unknown[]) => Promise<unknown>
    create: (...args: unknown[]) => Promise<unknown>
    delete: (...args: unknown[]) => Promise<unknown>
  }
}).notificationSubscription

function isMissingNotificationSubscriptionTableError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const candidate = error as { code?: unknown; message?: unknown }
  const code = typeof candidate.code === 'string' ? candidate.code : ''
  const message = typeof candidate.message === 'string' ? candidate.message : ''
  return code === 'P2021' && message.toLowerCase().includes('notificationsubscription')
}

async function resolveExtensionDbId(inputExtensionId: string): Promise<string | null> {
  const extension = await prisma.globalExtension.findFirst({
    where: {
      OR: [{ id: inputExtensionId }, { storeId: inputExtensionId }],
    },
    select: { id: true },
  })
  return extension?.id ?? null
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { extensionId } = await req.json().catch(() => ({}))
    if (!extensionId || typeof extensionId !== 'string') {
      return NextResponse.json({ error: 'extensionId is required' }, { status: 400 })
    }
    const normalizedExtensionId = await resolveExtensionDbId(extensionId)
    if (!normalizedExtensionId) {
      return NextResponse.json({ error: 'Extension not found' }, { status: 404 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    })
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    if (!notificationSubscriptionModel) {
      return NextResponse.json({ subscribed: false, degraded: true })
    }
    const existing = await notificationSubscriptionModel.findUnique({
      where: { userId_extensionId: { userId: user.id, extensionId: normalizedExtensionId } },
    })
    if (existing) {
      return NextResponse.json({ subscribed: true })
    }

    await notificationSubscriptionModel.create({
      data: { userId: user.id, extensionId: normalizedExtensionId },
    })

    return NextResponse.json({ subscribed: true })
  } catch (e) {
    if (isMissingNotificationSubscriptionTableError(e)) {
      return NextResponse.json({ subscribed: false, degraded: true })
    }
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: 'Failed to subscribe', details: msg }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { extensionId } = await req.json().catch(() => ({}))
    if (!extensionId || typeof extensionId !== 'string') {
      return NextResponse.json({ error: 'extensionId is required' }, { status: 400 })
    }
    const normalizedExtensionId = await resolveExtensionDbId(extensionId)
    if (!normalizedExtensionId) {
      return NextResponse.json({ unsubscribed: true })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    })
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    if (!notificationSubscriptionModel) {
      return NextResponse.json({ unsubscribed: true, degraded: true })
    }
    await notificationSubscriptionModel
      .delete({
        where: { userId_extensionId: { userId: user.id, extensionId: normalizedExtensionId } },
      })
      .catch(() => null)

    return NextResponse.json({ unsubscribed: true })
  } catch (e) {
    if (isMissingNotificationSubscriptionTableError(e)) {
      return NextResponse.json({ unsubscribed: true, degraded: true })
    }
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: 'Failed to unsubscribe', details: msg }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const extensionId = req.nextUrl.searchParams.get('extensionId')?.trim()
    if (!extensionId) {
      return NextResponse.json({ error: 'extensionId is required' }, { status: 400 })
    }
    const normalizedExtensionId = await resolveExtensionDbId(extensionId)
    if (!normalizedExtensionId) {
      return NextResponse.json({ subscribed: false })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    })
    if (!user) {
      return NextResponse.json({ subscribed: false })
    }

    if (!notificationSubscriptionModel) {
      return NextResponse.json({ subscribed: false, degraded: true })
    }
    const sub = await notificationSubscriptionModel.findUnique({
      where: { userId_extensionId: { userId: user.id, extensionId: normalizedExtensionId } },
    })

    return NextResponse.json({ subscribed: !!sub })
  } catch (e) {
    if (isMissingNotificationSubscriptionTableError(e)) {
      return NextResponse.json({ subscribed: false, degraded: true })
    }
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: 'Failed to check subscription', details: msg }, { status: 500 })
  }
}
