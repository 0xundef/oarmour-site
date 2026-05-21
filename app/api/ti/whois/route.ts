import { NextRequest, NextResponse } from 'next/server'
import { lookupDomainWhois } from '@/lib/domain-whois-lookup'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const domain = req.nextUrl.searchParams.get('domain')
  if (!domain) {
    return NextResponse.json({ error: 'domain is required' }, { status: 400 })
  }

  const result = await lookupDomainWhois(domain)
  if (!result.ok) {
    return NextResponse.json(
      { error: 'failed', details: result.error ?? 'lookup failed' },
      { status: 500 },
    )
  }

  return NextResponse.json({
    ok: true,
    domain: result.domain,
    tld: result.tld,
    source: result.source,
    info: {
      ...result.info,
      createTime: result.info?.createdDate ?? null,
    },
  })
}
