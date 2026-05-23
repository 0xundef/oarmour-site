import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth-options'
import { listPublisherVersionsForStore } from '@/lib/extension-publisher-versions'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

async function requireAdmin() {
  const session = await getServerSession(authOptions)
  if (session?.user?.role !== 'ADMIN') {
    return null
  }
  return session
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const session = await requireAdmin()
  if (!session) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await context.params
  if (!id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  }

  const extension = await prisma.globalExtension.findUnique({
    where: { id },
    select: { id: true, storeId: true },
  })
  if (!extension) {
    return NextResponse.json({ error: 'Extension not found' }, { status: 404 })
  }

  const releases = await listPublisherVersionsForStore(extension.storeId)
  return NextResponse.json({ releases })
}
