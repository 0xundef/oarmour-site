import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { normalizeAllowlistDomain } from '@/lib/finding-resolution'
import { requireSubscribedFindingActor } from '@/lib/finding-resolution-api'

export const runtime = 'nodejs'

type RouteContext = { params: Promise<{ storeId: string }> }

export async function GET(_req: Request, context: RouteContext) {
  const { storeId } = await context.params
  const trimmed = storeId?.trim()
  if (!trimmed) {
    return NextResponse.json({ error: 'Missing storeId.' }, { status: 400 })
  }

  const actor = await requireSubscribedFindingActor(trimmed)
  if ('error' in actor) return actor.error

  const rows = await prisma.extensionDomainAllowlist.findMany({
    where: { storeId: trimmed },
    orderBy: { createdAt: 'desc' },
    select: { domain: true, note: true, createdAt: true },
  })

  return NextResponse.json({
    entries: rows.map((r) => ({
      domain: normalizeAllowlistDomain(r.domain),
      note: r.note,
      createdAt: r.createdAt.toISOString(),
    })),
  })
}

export async function POST(req: Request, context: RouteContext) {
  const { storeId } = await context.params
  const trimmed = storeId?.trim()
  if (!trimmed) {
    return NextResponse.json({ error: 'Missing storeId.' }, { status: 400 })
  }

  const actor = await requireSubscribedFindingActor(trimmed)
  if ('error' in actor) return actor.error

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const obj = body && typeof body === 'object' ? (body as Record<string, unknown>) : null
  const domainRaw = typeof obj?.domain === 'string' ? obj.domain.trim() : ''
  const note = typeof obj?.note === 'string' ? obj.note.trim() : ''
  const domain = domainRaw ? normalizeAllowlistDomain(domainRaw) : ''
  if (!domain) {
    return NextResponse.json({ error: 'domain is required.' }, { status: 400 })
  }

  const row = await prisma.extensionDomainAllowlist.upsert({
    where: { storeId_domain: { storeId: trimmed, domain } },
    create: {
      storeId: trimmed,
      domain,
      note: note || null,
      addedByUserId: actor.userId,
    },
    update: {
      note: note || null,
      addedByUserId: actor.userId,
    },
    select: { domain: true, note: true, createdAt: true },
  })

  return NextResponse.json({
    entry: {
      domain: normalizeAllowlistDomain(row.domain),
      note: row.note,
      createdAt: row.createdAt.toISOString(),
    },
  })
}

export async function DELETE(req: Request, context: RouteContext) {
  const { storeId } = await context.params
  const trimmed = storeId?.trim()
  if (!trimmed) {
    return NextResponse.json({ error: 'Missing storeId.' }, { status: 400 })
  }

  const actor = await requireSubscribedFindingActor(trimmed)
  if ('error' in actor) return actor.error

  const { searchParams } = new URL(req.url)
  const domainRaw = searchParams.get('domain')?.trim() ?? ''
  const domain = domainRaw ? normalizeAllowlistDomain(domainRaw) : ''
  if (!domain) {
    return NextResponse.json({ error: 'domain query param is required.' }, { status: 400 })
  }

  await prisma.extensionDomainAllowlist.deleteMany({
    where: { storeId: trimmed, domain },
  })

  return NextResponse.json({ ok: true })
}
