import { whoisDomain, firstResult } from 'whoiser'

function parseDate(input: unknown): Date | null {
  if (!input) return null
  const s = String(input).trim()
  const iso = new Date(s)
  if (!isNaN(iso.getTime())) return iso
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}):(\d{2})(Z)?)?$/)
  if (m) {
    const y = m[1], mo = m[2], d = m[3]
    const hh = m[4] || '00', mm = m[5] || '00', ss = m[6] || '00'
    return new Date(`${y}-${mo}-${d}T${hh}:${mm}:${ss}Z`)
  }
  return null
}

export async function whoisInfo(domain: string): Promise<{
  createdDate: Date | null
  updatedDate: Date | null
  expiresDate: Date | null
  registrar: string | null
  nameservers: string[]
}> {
  const res = await whoisDomain(domain, { timeout: 6000, follow: 1 })
  const r: Record<string, any> = firstResult(res) || {}
  const keys = Object.keys(r)
  const findKey = (needle: string, exact?: boolean) =>
    keys.find((k) => {
      const kl = k.toLowerCase()
      const nl = needle.toLowerCase()
      return exact ? kl === nl : kl.includes(nl)
    })
  const createdKey = findKey('creation date')
  const updatedKey = findKey('updated date')
  const expiryKey = findKey('registry expiry date') || findKey('expiry date') || findKey('expiration date')
  const registrarKey = keys.find((k) => k.toLowerCase() === 'registrar')
  const nsKeys = keys.filter((k) => k.toLowerCase().includes('name server'))
  const createdDate = parseDate(createdKey ? r[createdKey] : null)
  const updatedDate = parseDate(updatedKey ? r[updatedKey] : null)
  const expiresDate = parseDate(expiryKey ? r[expiryKey] : null)
  const registrar = registrarKey ? String(r[registrarKey]) : null
  const nameservers: string[] = []
  for (const k of nsKeys) {
    const v = r[k]
    if (Array.isArray(v)) {
      for (const item of v) {
        if (item) nameservers.push(String(item).toLowerCase())
      }
    } else if (v) {
      nameservers.push(String(v).toLowerCase())
    }
  }
  return { createdDate, updatedDate, expiresDate, registrar, nameservers }
}

export async function whoisGetCreationDate(domain: string): Promise<Date | null> {
  const tld = domain.split('.').pop()?.toLowerCase()
  if (tld === 'com') {
    const info = await whoisInfo(domain)
    return info.createdDate
  }
  return null
}
