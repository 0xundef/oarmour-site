import { whoisInfo as whoisInfoComImpl, whoisGetCreationDate as whoisGetCreationDateCom } from './whois_com'
import { whoisInfo as whoisInfoHkImpl } from './whois_hk'
export * from './virustotal'
export * from './rdap'
export { whoisInfo as whoisInfoCom, whoisGetCreationDate as whoisGetCreationDateCom } from './whois_com'
export { whoisInfo as whoisInfoHk } from './whois_hk'

export type WhoisInfoResult = {
  createdDate: Date | null
  updatedDate: Date | null
  expiresDate: Date | null
  registrar: string | null
  nameservers: string[]
}

export async function whoisInfo(domain: string): Promise<WhoisInfoResult> {
  const tld = domain.split('.').pop()?.toLowerCase()
  if (tld === 'com') return whoisInfoComImpl(domain)
  if (tld === 'hk') return whoisInfoHkImpl(domain)
  return { createdDate: null, updatedDate: null, expiresDate: null, registrar: null, nameservers: [] }
}
