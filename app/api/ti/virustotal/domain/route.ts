import { NextRequest, NextResponse } from 'next/server'
import { vtGetDomain } from '@/lib/threat-intel'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const domain = url.searchParams.get('domain')
    if (!domain) {
      return NextResponse.json({ error: 'domain is required' }, { status: 400 })
    }
    const data = await vtGetDomain(domain)
    return NextResponse.json({ ok: true, domain, data })
  } catch (e: any) {
    const status = e?.response?.status
    const details = e?.response?.data ?? e?.message ?? 'error'
    const s = typeof status === 'number' && status >= 400 && status < 600 ? status : 500
    return NextResponse.json({ error: 'failed', details }, { status: s })
  }
}
