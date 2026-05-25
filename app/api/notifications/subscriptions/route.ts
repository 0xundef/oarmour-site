import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { loadSubscribedNavChildren } from '@/lib/subscribed-nav'

export const runtime = 'nodejs'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const items = await loadSubscribedNavChildren({
    id: session.user.id,
    email: session.user.email,
  })

  return NextResponse.json({ items })
}
