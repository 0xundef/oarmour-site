import fs from "fs"
import path from "path"
import { listAiTestingRunsWithRecordings } from "@/lib/extension-storage"
import {
  parseNetworkLogFile,
  type AiTestingNetworkLog,
  type AiTestingNetworkRequest,
} from "@/lib/ai-testing-network"

const DEFAULT_MAX_REQUESTS = 40
const MAX_BODY_CHARS = 16_384

export type AiTestingTraceNetworkEntry = {
  method: string
  url: string
  status: number | null
  failed?: boolean
  errorText?: string
  resourceType?: string
  startedDateTime?: string
  requestHeaders?: Record<string, string>
  requestBody?: string | null
  requestBodyTruncated?: boolean
  responseMimeType?: string
  responseBody?: string | null
  responseBodyTruncated?: boolean
}

export type AiTestingTraceReadResult = {
  ok: boolean
  source: "network.json" | "playwright_trace_network" | null
  version: string | null
  runId: string | null
  capturedAt: string | null
  traceNetworkPath: string | null
  requestCount: number
  returnedCount: number
  requests: AiTestingTraceNetworkEntry[]
  error?: string
}

function truncateText(value: string, maxChars: number): { text: string; truncated: boolean } {
  if (value.length <= maxChars) return { text: value, truncated: false }
  return { text: `${value.slice(0, maxChars)}…`, truncated: true }
}

function shouldIncludeUrl(url: string, urlContains?: string): boolean {
  if (!urlContains?.trim()) return true
  return url.toLowerCase().includes(urlContains.trim().toLowerCase())
}

function mapNetworkJsonRequest(req: AiTestingNetworkRequest): AiTestingTraceNetworkEntry {
  const entry: AiTestingTraceNetworkEntry = {
    method: req.method,
    url: req.url,
    status: req.status,
  }
  if (req.failed) entry.failed = true
  if (req.errorText) entry.errorText = req.errorText
  if (req.resourceType) entry.resourceType = req.resourceType
  if (req.requestedAt) entry.startedDateTime = req.requestedAt
  if (req.requestHeaders) entry.requestHeaders = req.requestHeaders
  if (req.requestBody !== undefined) {
    if (req.requestBody === null) {
      entry.requestBody = null
    } else {
      const { text, truncated } = truncateText(req.requestBody, MAX_BODY_CHARS)
      entry.requestBody = text
      if (truncated || req.requestBodyTruncated) entry.requestBodyTruncated = true
    }
  }
  return entry
}

function loadFromNetworkJson(params: {
  networkPath: string
  urlContains?: string
  maxRequests: number
}): { log: AiTestingNetworkLog; requests: AiTestingTraceNetworkEntry[] } | null {
  const log = parseNetworkLogFile(params.networkPath)
  if (!log) return null

  const filtered = log.requests
    .filter((r) => shouldIncludeUrl(r.url, params.urlContains))
    .slice(0, params.maxRequests)
    .map(mapNetworkJsonRequest)

  return { log, requests: filtered }
}

type TraceResourceSnapshot = {
  startedDateTime?: string
  request?: {
    method?: string
    url?: string
    headers?: Array<{ name: string; value: string }>
    postData?: { text?: string; mimeType?: string }
  }
  response?: {
    status?: number
    content?: { mimeType?: string; text?: string; _sha1?: string }
  }
}

function headersToRecord(
  headers?: Array<{ name: string; value: string }>,
): Record<string, string> | undefined {
  if (!headers?.length) return undefined
  const out: Record<string, string> = {}
  for (const h of headers) {
    if (h.name && !h.name.startsWith(":")) out[h.name] = h.value
  }
  return Object.keys(out).length > 0 ? out : undefined
}

function readResourceText(resourcesDir: string, sha1?: string): string | null {
  if (!sha1) return null
  const filePath = path.join(resourcesDir, sha1)
  if (!fs.existsSync(filePath)) return null
  try {
    const buf = fs.readFileSync(filePath)
    if (buf.length === 0) return ""
    const asText = buf.toString("utf8")
    if (asText.includes("\u0000")) return buf.toString("base64")
    return asText
  } catch {
    return null
  }
}

function findLatestTraceNetworkFile(roots: string[]): string | null {
  const candidates: Array<{ filePath: string; mtimeMs: number }> = []

  for (const root of roots) {
    const tracesDir = path.join(root, ".playwright-cli", "traces")
    if (!fs.existsSync(tracesDir)) continue
    for (const name of fs.readdirSync(tracesDir)) {
      if (!name.endsWith(".network")) continue
      const filePath = path.join(tracesDir, name)
      try {
        const stat = fs.statSync(filePath)
        if (stat.isFile()) candidates.push({ filePath, mtimeMs: stat.mtimeMs })
      } catch {
        // skip
      }
    }
  }

  candidates.sort((a, b) => b.mtimeMs - a.mtimeMs)
  return candidates[0]?.filePath ?? null
}

function loadFromPlaywrightTraceNetwork(params: {
  networkPath: string
  urlContains?: string
  maxRequests: number
  includeBodies: boolean
}): AiTestingTraceNetworkEntry[] {
  const resourcesDir = path.join(path.dirname(params.networkPath), "resources")
  const lines = fs.readFileSync(params.networkPath, "utf8").split("\n")
  const entries: AiTestingTraceNetworkEntry[] = []

  for (const line of lines) {
    if (!line.trim() || entries.length >= params.maxRequests) break
    let row: { snapshot?: TraceResourceSnapshot }
    try {
      row = JSON.parse(line) as { snapshot?: TraceResourceSnapshot }
    } catch {
      continue
    }
    const snap = row.snapshot
    const url = snap?.request?.url
    const method = snap?.request?.method
    if (!url || !method) continue
    if (!shouldIncludeUrl(url, params.urlContains)) continue
    if (url.toLowerCase().startsWith("chrome-extension://")) continue

    const entry: AiTestingTraceNetworkEntry = {
      method,
      url,
      status: typeof snap.response?.status === "number" ? snap.response.status : null,
      startedDateTime: snap.startedDateTime,
      requestHeaders: headersToRecord(snap.request?.headers),
    }

    if (params.includeBodies) {
      const postText = snap.request?.postData?.text
      if (postText) {
        const { text, truncated } = truncateText(postText, MAX_BODY_CHARS)
        entry.requestBody = text
        if (truncated) entry.requestBodyTruncated = true
      }

      const content = snap.response?.content
      if (content) {
        entry.responseMimeType = content.mimeType
        let bodyText = content.text ?? null
        if (bodyText == null && content._sha1) {
          bodyText = readResourceText(resourcesDir, content._sha1)
        }
        if (bodyText != null) {
          const { text, truncated } = truncateText(bodyText, MAX_BODY_CHARS)
          entry.responseBody = text
          if (truncated) entry.responseBodyTruncated = true
        }
      }
    }

    entries.push(entry)
  }

  return entries
}

export function readAiTestingNetworkTrace(params: {
  storeId: string
  version: string
  runId?: string
  urlContains?: string
  maxRequests?: number
  includeBodies?: boolean
}): AiTestingTraceReadResult {
  const maxRequests = Math.min(
    100,
    Math.max(1, params.maxRequests ?? DEFAULT_MAX_REQUESTS),
  )
  const includeBodies = params.includeBodies !== false

  const runs = listAiTestingRunsWithRecordings(params.storeId, params.version)
  const run =
    (params.runId
      ? runs.find((r) => r.runId === params.runId)
      : runs[0]) ?? null

  if (!run) {
    return {
      ok: false,
      source: null,
      version: params.version,
      runId: params.runId ?? null,
      capturedAt: null,
      traceNetworkPath: null,
      requestCount: 0,
      returnedCount: 0,
      requests: [],
      error: "No ai_testing run with recordings.json found for this extension version.",
    }
  }

  const networkPath = path.join(run.runRoot, "network.json")
  if (fs.existsSync(networkPath)) {
    const loaded = loadFromNetworkJson({ networkPath, urlContains: params.urlContains, maxRequests })
    if (loaded) {
      return {
        ok: true,
        source: "network.json",
        version: run.version,
        runId: run.runId,
        capturedAt: loaded.log.capturedAt || null,
        traceNetworkPath: null,
        requestCount: loaded.log.requestCount,
        returnedCount: loaded.requests.length,
        requests: loaded.requests,
      }
    }
  }

  const sidecarRoot = path.dirname(path.dirname(run.runRoot))
  const traceNetworkPath = findLatestTraceNetworkFile([run.runRoot, sidecarRoot])

  if (!traceNetworkPath) {
    return {
      ok: false,
      source: null,
      version: run.version,
      runId: run.runId,
      capturedAt: null,
      traceNetworkPath: null,
      requestCount: 0,
      returnedCount: 0,
      requests: [],
      error: `No network.json in run ${run.runId} and no .playwright-cli/traces/*.network found.`,
    }
  }

  const requests = loadFromPlaywrightTraceNetwork({
    networkPath: traceNetworkPath,
    urlContains: params.urlContains,
    maxRequests,
    includeBodies,
  })

  return {
    ok: true,
    source: "playwright_trace_network",
    version: run.version,
    runId: run.runId,
    capturedAt: null,
    traceNetworkPath,
    requestCount: requests.length,
    returnedCount: requests.length,
    requests,
  }
}
