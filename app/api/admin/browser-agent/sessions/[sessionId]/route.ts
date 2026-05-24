import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth-options'
import { cancelTaskSession } from '@/lib/browser-agent-control'

export const runtime = 'nodejs'

async function requireAdmin() {
  const session = await getServerSession(authOptions)
  if (session?.user?.role !== 'ADMIN') return null
  return session
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ sessionId: string }> },
) {
  const session = await requireAdmin()
  if (!session) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { sessionId } = await context.params
  if (!sessionId?.trim()) {
    return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 })
  }

  try {
    await cancelTaskSession(sessionId.trim())
    return NextResponse.json({ ok: true, sessionId: sessionId.trim() })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to cancel session'
    const status =
      message === 'not_found' ? 404 : message === 'already_finished' ? 409 : 502
    return NextResponse.json({ error: message }, { status })
  }
}
