import fs from 'fs'

/** Matches browseragent `lib/network-capture.ts` NetworkRequestEntry. */
export type AiTestingNetworkRequest = {
  method: string
  url: string
  status: number | null
  failed?: boolean
  errorText?: string
  resourceType?: 'fetch' | 'xhr' | 'websocket'
  requestedAt?: string
  requestHeaders?: Record<string, string>
}

/** Matches browseragent `lib/network-capture.ts` NetworkLog. */
export type AiTestingNetworkLog = {
  capturedAt: string
  filter: string
  /** e.g. `"playwright-cli requests"` from browseragent */
  source?: string
  /** Whether capture used `playwright-cli requests --static`. */
  includeStatic?: boolean
  resourceTypes?: string[]
  requestCount: number
  requests: AiTestingNetworkRequest[]
}

function parseRequestRow(row: Record<string, unknown>): AiTestingNetworkRequest | null {
  const method = typeof row.method === 'string' ? row.method : ''
  const url = typeof row.url === 'string' ? row.url : ''
  if (!method || !url) return null

  const status =
    typeof row.status === 'number' ? row.status : row.status === null ? null : null

  const failed = row.failed === true
  const errorText = typeof row.errorText === 'string' ? row.errorText : undefined

  const resourceTypeRaw = row.resourceType
  const resourceType =
    resourceTypeRaw === 'fetch' ||
    resourceTypeRaw === 'xhr' ||
    resourceTypeRaw === 'websocket'
      ? resourceTypeRaw
      : undefined

  const requestedAt = typeof row.requestedAt === 'string' ? row.requestedAt : undefined

  const requestHeaders =
    row.requestHeaders &&
    typeof row.requestHeaders === 'object' &&
    !Array.isArray(row.requestHeaders)
      ? (row.requestHeaders as Record<string, string>)
      : undefined

  return {
    method,
    url,
    status,
    ...(failed ? { failed: true } : {}),
    ...(errorText ? { errorText } : {}),
    resourceType,
    requestedAt,
    requestHeaders,
  }
}

export function parseNetworkLogFile(filePath: string): AiTestingNetworkLog | null {
  if (!fs.existsSync(filePath)) return null
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown
    if (!parsed || typeof parsed !== 'object') return null
    const obj = parsed as Record<string, unknown>

    const requests = Array.isArray(obj.requests)
      ? obj.requests.flatMap((item): AiTestingNetworkRequest[] => {
          if (!item || typeof item !== 'object') return []
          const row = parseRequestRow(item as Record<string, unknown>)
          return row ? [row] : []
        })
      : []

    const resourceTypes = Array.isArray(obj.resourceTypes)
      ? obj.resourceTypes.filter((v): v is string => typeof v === 'string')
      : undefined

    const source = typeof obj.source === 'string' ? obj.source : undefined
    const includeStatic = obj.includeStatic === true

    return {
      capturedAt: typeof obj.capturedAt === 'string' ? obj.capturedAt : '',
      filter: typeof obj.filter === 'string' ? obj.filter : '',
      source,
      ...(includeStatic ? { includeStatic: true } : {}),
      resourceTypes,
      requestCount:
        typeof obj.requestCount === 'number' ? obj.requestCount : requests.length,
      requests,
    }
  } catch {
    return null
  }
}
