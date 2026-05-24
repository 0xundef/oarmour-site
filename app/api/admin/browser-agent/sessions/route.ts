import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth-options'
import {
  cancelTaskSession,
  enqueueTaskSession,
  getBrowserAgentApiBaseUrl,
  listTaskSessions,
} from '@/lib/browser-agent-control'

export const runtime = 'nodejs'

async function requireAdmin() {
  const session = await getServerSession(authOptions)
  if (session?.user?.role !== 'ADMIN') return null
  return session
}

export async function GET() {
  const session = await requireAdmin()
  if (!session) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const result = await listTaskSessions()
    return NextResponse.json({
      ...result,
      apiConfigured: Boolean(getBrowserAgentApiBaseUrl()),
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to list task sessions'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}

export async function POST(req: Request) {
  const session = await requireAdmin()
  if (!session) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({} as Record<string, unknown>))
  const extensionId =
    typeof body?.extensionId === 'string'
      ? body.extensionId.trim()
      : typeof body?.storeId === 'string'
        ? body.storeId.trim()
        : ''
  const version = typeof body?.version === 'string' ? body.version.trim() : ''
  const name = typeof body?.name === 'string' ? body.name.trim() : null

  if (!extensionId || !version) {
    return NextResponse.json({ error: 'extensionId and version are required' }, { status: 400 })
  }

  try {
    const result = await enqueueTaskSession({ extensionId, version, name })
    return NextResponse.json({
      ok: true,
      sessionId: result.sessionId,
      source: result.source,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to enqueue task'
    const status = message === 'already_queued' ? 409 : 502
    return NextResponse.json({ error: message }, { status })
  }
}
