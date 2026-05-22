import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  domainFromMaliciousFindingIssueId,
  isFindingDismissalReason,
  normalizeAllowlistDomain,
} from '@/lib/finding-resolution'
import { requireSubscribedFindingActor } from '@/lib/finding-resolution-api'

export const runtime = 'nodejs'

type RouteContext = { params: Promise<{ storeId: string }> }

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
  const issueId = typeof obj?.issueId === 'string' ? obj.issueId.trim() : ''
  const reason = typeof obj?.reason === 'string' ? obj.reason.trim() : ''
  const note = typeof obj?.note === 'string' ? obj.note.trim() : ''
  const extensionVersion =
    typeof obj?.extensionVersion === 'string' ? obj.extensionVersion.trim() : null
  const alsoAllowlistDomain =
    obj?.alsoAllowlistDomain === true || obj?.alsoAllowlistDomain === 'true'

  if (!issueId) {
    return NextResponse.json({ error: 'issueId is required.' }, { status: 400 })
  }
  if (!isFindingDismissalReason(reason)) {
    return NextResponse.json({ error: 'Invalid dismissal reason.' }, { status: 400 })
  }

  await prisma.findingDismissal.upsert({
    where: {
      userId_storeId_issueId: {
        userId: actor.userId,
        storeId: trimmed,
        issueId,
      },
    },
    create: {
      userId: actor.userId,
      storeId: trimmed,
      issueId,
      extensionVersion: extensionVersion || null,
      reason,
      note: note || null,
    },
    update: {
      extensionVersion: extensionVersion || null,
      reason,
      note: note || null,
    },
  })

  let allowlistedDomain: string | null = null
  if (alsoAllowlistDomain) {
    const domain = domainFromMaliciousFindingIssueId(issueId)
    if (domain) {
      allowlistedDomain = normalizeAllowlistDomain(domain)
      await prisma.extensionDomainAllowlist.upsert({
        where: {
          storeId_domain: { storeId: trimmed, domain: allowlistedDomain },
        },
        create: {
          storeId: trimmed,
          domain: allowlistedDomain,
          note: note || null,
          addedByUserId: actor.userId,
        },
        update: {
          note: note || null,
          addedByUserId: actor.userId,
        },
      })
    }
  }

  return NextResponse.json({ ok: true, allowlistedDomain })
}
