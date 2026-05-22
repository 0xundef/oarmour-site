import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth-options'
import { deleteExtensionVersion, listExtensionVersions } from '@/lib/extension-version-cleanup'
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

  const versions = await listExtensionVersions(extension.id, extension.storeId)
  return NextResponse.json({ versions })
}

export async function DELETE(
  req: NextRequest,
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

  const body = await req.json().catch(() => ({} as Record<string, unknown>))
  const version = typeof body?.version === 'string' ? body.version.trim() : ''
  if (!version) {
    return NextResponse.json({ error: 'version is required' }, { status: 400 })
  }

  const extension = await prisma.globalExtension.findUnique({
    where: { id },
    select: { id: true, storeId: true, name: true },
  })
  if (!extension) {
    return NextResponse.json({ error: 'Extension not found' }, { status: 404 })
  }

  try {
    const result = await deleteExtensionVersion({
      extensionId: extension.id,
      storeId: extension.storeId,
      version,
    })
    return NextResponse.json({ ok: true, ...result })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Delete failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
