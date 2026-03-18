import { NextRequest, NextResponse } from 'next/server'
import { rdapDomain } from '@/lib/threat-intel'
import { getDomain } from 'tldts'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  try {
    const domain = req.nextUrl.searchParams.get('domain')
    if (!domain) {
      return NextResponse.json({ error: 'domain is required' }, { status: 400 })
    }
    const apex = getDomain(domain) || domain
    const data = await rdapDomain(apex)
    return NextResponse.json({ ok: true, domain: apex, data })
  } catch (e: any) {
    const status = e?.response?.status
    const details = e?.response?.data ?? e?.message ?? 'error'
    const s = typeof status === 'number' && status >= 400 && status < 600 ? status : 500
    return NextResponse.json({ error: 'failed', details }, { status: s })
  }
}
