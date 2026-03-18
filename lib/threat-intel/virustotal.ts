import axios from 'axios'

export type VirusTotalDomainResult = unknown

export async function vtGetDomain(domain: string): Promise<VirusTotalDomainResult> {
  const key = process.env.VIRUSTOTAL_API_KEY
  if (!key) throw new Error('Missing VirusTotal API key')
  const resp = await axios.get(`https://www.virustotal.com/api/v3/domains/${domain}`, {
    headers: {
      accept: 'application/json',
      'x-apikey': key,
    },
    timeout: 12000,
  })
  return resp.data
}
