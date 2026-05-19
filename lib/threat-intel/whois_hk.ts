import { whoisDomain, firstResult } from 'whoiser'

function parseDate(input: unknown): Date | null {
  if (!input) return null
  const s = String(input).trim()
  const iso = new Date(s)
  if (!isNaN(iso.getTime())) return iso
  const m1 = s.match(/^(\d{2})[-\/](\d{2})[-\/](\d{4})$/)
  if (m1) {
    const d = m1[1], mo = m1[2], y = m1[3]
    return new Date(`${y}-${mo}-${d}T00:00:00Z`)
  }
  const m2 = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}):(\d{2})(Z)?)?$/)
  if (m2) {
    const y = m2[1], mo = m2[2], d = m2[3]
    const hh = m2[4] || '00', mm = m2[5] || '00', ss = m2[6] || '00'
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
  const res = await whoisDomain(domain, { timeout: 8000, follow: 1, raw: true })
  const r: Record<string, any> = firstResult(res) || {}
  const keys = Object.keys(r)
  const raw = String((r as any).__raw || '')
  const findKey = (needle: string, exact?: boolean) =>
    keys.find((k) => {
      const kl = k.toLowerCase()
      const nl = needle.toLowerCase()
      return exact ? kl === nl : kl.includes(nl)
    })
  const createdKey =
    findKey('Domain Name Commencement Date') ||
    findKey('creation date') ||
    findKey('created date')
  const updatedKey = findKey('updated date') || findKey('last update')
  const expiryKey = findKey('expiry date') || findKey('expiration date')
  const registrarKey = keys.find((k) => k.toLowerCase() === 'registrar' || k.toLowerCase().includes('registrar name'))
  let createdVal = createdKey ? r[createdKey] : null
  let updatedVal = updatedKey ? r[updatedKey] : null
  let expiryVal = expiryKey ? r[expiryKey] : null
  if (!createdVal) {
    const m = raw.match(/Domain Name Commencement Date:\s*([0-9]{2}[-/][0-9]{2}[-/][0-9]{4})/i)
    if (m) createdVal = m[1]
  }
  if (!expiryVal) {
    const m = raw.match(/Expiry Date:\s*([0-9]{2}[-/][0-9]{2}[-/][0-9]{4})/i)
    if (m) expiryVal = m[1]
  }
  if (!updatedVal) {
    const m = raw.match(/Updated Date:\s*([0-9]{4}-[0-9]{2}-[0-9]{2}(?:[ T][0-9]{2}:[0-9]{2}:[0-9]{2}Z)?)/i)
    if (m) updatedVal = m[1]
  }
  const createdDate = parseDate(createdVal)
  const updatedDate = parseDate(updatedVal)
  const expiresDate = parseDate(expiryVal)
  const registrar = registrarKey ? String(r[registrarKey]) : null
  const nameservers: string[] = []
  const nsKeys = keys.filter((k) => k.toLowerCase().includes('name server'))
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
  if (nameservers.length === 0 && raw) {
    const re = /Name Server:\s*([A-Za-z0-9.-]+)/gi
    let m
    while ((m = re.exec(raw)) !== null) {
      nameservers.push(String(m[1]).toLowerCase())
    }
  }
  return { createdDate, updatedDate, expiresDate, registrar, nameservers }
}
