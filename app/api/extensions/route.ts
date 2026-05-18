import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { listExtensionsWithAnalysis, getDashboardMetrics } from '@/app/actions/get-extensions'

export const runtime = 'nodejs'

/** Dashboard extension list (avoids Server Action ID mismatch after redeploys). */
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const [extensions, metrics] = await Promise.all([
      listExtensionsWithAnalysis(),
      getDashboardMetrics(),
    ])
    return NextResponse.json({ extensions, metrics })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[api/extensions] GET failed:', message)
    return NextResponse.json({ error: 'Failed to load extensions' }, { status: 500 })
  }
}
