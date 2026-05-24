import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth-options'
import { closePlaywrightSession } from '@/lib/browser-agent-control'

export const runtime = 'nodejs'

async function requireAdmin() {
  const session = await getServerSession(authOptions)
  if (session?.user?.role !== 'ADMIN') return null
  return session
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ name: string }> },
) {
  const session = await requireAdmin()
  if (!session) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { name } = await context.params
  if (!name?.trim()) {
    return NextResponse.json({ error: 'Missing session name' }, { status: 400 })
  }

  try {
    await closePlaywrightSession(name.trim())
    return NextResponse.json({ ok: true, closed: name.trim() })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to close playwright session'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
