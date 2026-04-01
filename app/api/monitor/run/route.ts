import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth-options'
import { monitorExtensionsOnce } from '@/lib/monitor/extensions-monitor'

export const runtime = 'nodejs'

export async function GET() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 })
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (session?.user?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const payload = await req.json().catch(() => ({}))
  const storeId = typeof payload?.storeId === 'string' && payload.storeId.trim() ? payload.storeId.trim() : undefined
  const result = await monitorExtensionsOnce(storeId, { preferCdnNextVersion: !!storeId })
  if (storeId && result.checked === 0) {
    return NextResponse.json({ error: 'Extension not found', storeId }, { status: 404 })
  }
  return NextResponse.json(result)
}
