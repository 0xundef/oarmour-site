import { NextRequest, NextResponse } from 'next/server'
import { getDomain } from 'tldts'
import { whoisInfo, whoisInfoHk, rdapDomain } from '@/lib/threat-intel'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  try {
    const domain = req.nextUrl.searchParams.get('domain')
    if (!domain) {
      return NextResponse.json({ error: 'domain is required' }, { status: 400 })
    }
    const apex = getDomain(domain) || domain
    const tld = apex.split('.').pop()?.toLowerCase()
    let info: {
      createdDate: Date | null
      updatedDate: Date | null
      expiresDate: Date | null
      registrar: string | null
      nameservers: string[]
    }
    let source = 'rdap'
    if (tld === 'hk') {
      info = await whoisInfoHk(apex)
      source = 'whois_hk'
    } else if (tld === 'dev') {
      const r = await rdapDomain(apex)
      info = {
        createdDate: r.createdDate ?? null,
        updatedDate: null,
        expiresDate: r.expiresDate ?? null,
        registrar: r.registrar ?? null,
        nameservers: r.nameservers || [],
      }
    } else {
      try {
        const r = await rdapDomain(apex)
        info = {
          createdDate: r.createdDate ?? null,
          updatedDate: null,
          expiresDate: r.expiresDate ?? null,
          registrar: r.registrar ?? null,
          nameservers: r.nameservers || [],
        }
        source = 'rdap'
      } catch {
        info = {
          createdDate: null,
          updatedDate: null,
          expiresDate: null,
          registrar: null,
          nameservers: [],
        }
      }
      const hasCreatedDate =
        info.createdDate instanceof Date && !Number.isNaN(info.createdDate.getTime())
      if (!hasCreatedDate) {
        const hadRdapData =
          !!(info.registrar || info.expiresDate || info.nameservers.length > 0)
        const w = await whoisInfo(apex)
        info = {
          createdDate: w.createdDate ?? info.createdDate,
          updatedDate: w.updatedDate,
          expiresDate: info.expiresDate ?? w.expiresDate ?? null,
          registrar: info.registrar ?? w.registrar ?? null,
          nameservers: info.nameservers.length ? info.nameservers : w.nameservers,
        }
        source = hadRdapData ? 'rdap+whois' : tld === 'com' ? 'whois_com' : 'whois'
      }
    }
    return NextResponse.json({ ok: true, domain: apex, tld, source, info })
  } catch (e: any) {
    const status = e?.response?.status
    const details = e?.response?.data ?? e?.message ?? 'error'
    const s = typeof status === 'number' && status >= 400 && status < 600 ? status : 500
    return NextResponse.json({ error: 'failed', details }, { status: s })
  }
}
