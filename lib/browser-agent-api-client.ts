import 'server-only'

export function getBrowserAgentApiBaseUrl(): string | null {
  const base = process.env.BROWSER_AGENT_API_URL?.trim()
  return base ? base.replace(/\/+$/, '') : null
}

export function resolveBrowserAgentMaxConcurrent(): number {
  const raw =
    process.env.BROWSER_AGENT_MAX_CONCURRENT?.trim() ?? process.env.MAX_CONCURRENT_RUNS?.trim()
  if (!raw) return 1
  const parsed = Number(raw)
  if (!Number.isFinite(parsed) || parsed <= 0) return 1
  return Math.floor(parsed)
}

export async function agentApiFetch<T>(pathname: string, init?: RequestInit): Promise<T> {
  const base = getBrowserAgentApiBaseUrl()
  if (!base) {
    throw new Error('BROWSER_AGENT_API_URL is not configured')
  }
  const headers = new Headers(init?.headers)
  if (!headers.has('Content-Type') && init?.body) {
    headers.set('Content-Type', 'application/json')
  }
  const apiKey = process.env.BROWSER_AGENT_API_KEY?.trim()
  if (apiKey) {
    headers.set('Authorization', `Bearer ${apiKey}`)
  }
  const res = await fetch(`${base}${pathname}`, { ...init, headers, cache: 'no-store' })
  const json = (await res.json().catch(() => ({}))) as T & { error?: string; reason?: string }
  if (!res.ok) {
    const detail =
      typeof json?.error === 'string'
        ? json.error
        : typeof json?.reason === 'string'
          ? json.reason
          : `Browser agent API ${res.status}`
    throw new Error(`${res.status}: ${detail}`)
  }
  return json
}
