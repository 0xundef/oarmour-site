import { NextResponse } from 'next/server'
import { loadFindingResolutionsForUser } from '@/lib/finding-resolution-store'
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

  const snapshot = await loadFindingResolutionsForUser(actor.userId, trimmed)
  return NextResponse.json({
    dismissals: snapshot.dismissals,
    allowlist: snapshot.allowlist,
  })
}
