import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { enqueueAgentBrowserTestTask } from '@/lib/agent-queue'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const payload = await req.json().catch(() => ({} as Record<string, unknown>))
  const storeId = typeof payload?.storeId === 'string' ? payload.storeId.trim() : ''
  const version = typeof payload?.version === 'string' ? payload.version.trim() : ''
  const name = typeof payload?.name === 'string' ? payload.name.trim() : null

  if (!storeId) {
    return NextResponse.json({ error: 'storeId is required' }, { status: 400 })
  }
  if (!version || version === 'N/A') {
    return NextResponse.json({ error: 'version is required' }, { status: 400 })
  }

  const result = enqueueAgentBrowserTestTask({
    storeId,
    name,
    version,
    reason: 'manual_trigger',
  })

  if (result.queued) {
    return NextResponse.json({
      queued: true,
      entry: result.entry,
      message: 'AI testing enqueued. Agent browser will pick it up.',
    })
  }

  const reasonMessages: Record<string, string> = {
    disabled: 'AI testing is disabled on this server.',
    missing_version: 'Extension version is missing.',
    missing_prompt: 'AI testing prompt template is missing.',
    already_queued: 'AI testing is already queued or running for this version.',
  }

  return NextResponse.json(
    {
      queued: false,
      reason: result.reason,
      message: reasonMessages[result.reason] ?? `AI testing not enqueued: ${result.reason}`,
    },
    { status: 409 },
  )
}
