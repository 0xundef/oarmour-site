import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth-options'
import {
  getBrowserAgentApiBaseUrl,
  killAllPlaywrightSessions,
  listPlaywrightSessions,
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
    const result = await listPlaywrightSessions()
    return NextResponse.json({
      ...result,
      apiConfigured: Boolean(getBrowserAgentApiBaseUrl()),
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to list playwright sessions'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}

export async function POST(req: Request) {
  const session = await requireAdmin()
  if (!session) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({} as Record<string, unknown>))
  const force = body?.force === true

  try {
    await killAllPlaywrightSessions(force)
    return NextResponse.json({ ok: true, forceKilled: force })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to kill playwright sessions'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
