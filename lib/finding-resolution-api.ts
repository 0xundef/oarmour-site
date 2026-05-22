import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth-options'
import { assertSubscribedToExtension } from '@/lib/subscribed-extension-access'

export async function requireSubscribedFindingActor(storeId: string) {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id
  if (!userId) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  const access = await assertSubscribedToExtension({
    userId,
    email: session?.user?.email,
    storeId,
  })
  if (!access.ok) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: access.status }) }
  }

  return { userId, email: session?.user?.email ?? null }
}
