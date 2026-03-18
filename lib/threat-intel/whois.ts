import axios from 'axios'

export type WhoisDomainResult = {
  registrar: string | null
  status: string | null
  nameservers: string[]
  createdDate: Date | null
  expiresDate: Date | null
}

export async function whoisDomain(domain: string): Promise<WhoisDomainResult> {
  const resp = await axios.get(`https://rdap.org/domain/${domain}`, { timeout: 8000 })
  const data = resp.data || {}
  const registrar =
    Array.isArray(data.entities)
      ? (data.entities.find((e: any) => Array.isArray(e.roles) && e.roles.includes('registrar'))?.vcardArray?.[1]?.find((v: any) => v[0] === 'fn')?.[3] ?? null)
      : null
  const nameservers =
    Array.isArray(data.nameservers)
      ? data.nameservers.map((n: any) => n.ldhName).filter(Boolean)
      : []
  let createdDate: Date | null = null
  let expiresDate: Date | null = null
  if (Array.isArray(data.events)) {
    const reg = data.events.find((e: any) => e.eventAction === 'registration')?.eventDate
    const exp = data.events.find((e: any) => e.eventAction === 'expiration')?.eventDate
    createdDate = reg ? new Date(reg) : null
    expiresDate = exp ? new Date(exp) : null
  }
  const status =
    Array.isArray(data.status) ? String(data.status.join(',')) : null
  return { registrar, status, nameservers, createdDate, expiresDate }
}
