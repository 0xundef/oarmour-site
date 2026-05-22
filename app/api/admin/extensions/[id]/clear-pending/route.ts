import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth-options'
import { clearExtensionPendingHalfState } from '@/lib/extension-version-cleanup'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

export async function POST(
  _req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions)
  if (session?.user?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await context.params
  if (!id?.trim()) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  }

  const extension = await prisma.globalExtension.findUnique({
    where: { id: id.trim() },
    select: { id: true, storeId: true, name: true },
  })
  if (!extension) {
    return NextResponse.json({ error: 'Extension not found' }, { status: 404 })
  }

  try {
    const result = await clearExtensionPendingHalfState({
      extensionId: extension.id,
      storeId: extension.storeId,
    })
    return NextResponse.json({ ok: true, ...result })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Clear pending failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
