import { isIP } from "node:net"
import { lookup } from "node:dns/promises"

const FETCH_TIMEOUT_MS = 12_000
const MAX_REDIRECTS = 5
const MAX_BODY_BYTES = 1_500_000
const MAX_EXCERPT_CHARS = 12_000
const USER_AGENT = "OArmour-Investigation/1.0 (+https://oarmour.io)"

export type FetchWebPageResult = {
  ok: boolean
  url: string
  finalUrl?: string
  status?: number
  title?: string
  excerpt?: string
  contentType?: string
  fetchedAt: string
  error?: string
}

function isPrivateIpv4(host: string): boolean {
  const parts = host.split(".").map((p) => Number(p))
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return false
  const [a, b] = parts
  if (a === 10) return true
  if (a === 127) return true
  if (a === 0) return true
  if (a === 169 && b === 254) return true
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 192 && b === 168) return true
  if (a === 100 && b >= 64 && b <= 127) return true
  return false
}

function isBlockedHostname(hostname: string): boolean {
  const host = hostname.trim().toLowerCase().replace(/\.$/, "")
  if (!host) return true
  if (host === "localhost" || host.endsWith(".localhost")) return true
  if (host.endsWith(".local") || host.endsWith(".internal")) return true
  if (host === "metadata.google.internal" || host === "metadata") return true

  const ipVersion = isIP(host)
  if (ipVersion === 4) return isPrivateIpv4(host)
  if (ipVersion === 6) {
    const normalized = host.toLowerCase()
    if (normalized === "::1" || normalized === "::") return true
    if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true
    if (normalized.startsWith("fe80:")) return true
  }
  return false
}

async function hostnameResolvesToBlockedIp(hostname: string): Promise<boolean> {
  if (isIP(hostname)) return isBlockedHostname(hostname)
  try {
    const records = await lookup(hostname, { all: true, verbatim: true })
    if (!records.length) return true
    return records.some((entry) => isBlockedHostname(entry.address))
  } catch {
    return true
  }
}

export async function assertPublicHttpsUrl(rawUrl: string): Promise<URL> {
  let parsed: URL
  try {
    parsed = new URL(rawUrl.trim())
  } catch {
    throw new Error("Invalid URL")
  }
  if (parsed.protocol !== "https:") {
    throw new Error("Only HTTPS URLs are allowed")
  }
  if (parsed.username || parsed.password) {
    throw new Error("URLs with credentials are not allowed")
  }
  if (!parsed.hostname) {
    throw new Error("URL must include a hostname")
  }
  if (isBlockedHostname(parsed.hostname)) {
    throw new Error("URL hostname is not allowed")
  }
  if (await hostnameResolvesToBlockedIp(parsed.hostname)) {
    throw new Error("URL resolves to a private or disallowed address")
  }
  return parsed
}

function htmlToPlainText(html: string): { title: string | null; text: string } {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  const title = titleMatch
    ? titleMatch[1]
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 300)
    : null

  let body = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim()

  if (body.length > MAX_EXCERPT_CHARS) {
    body = `${body.slice(0, MAX_EXCERPT_CHARS)}…`
  }

  return { title: title || null, text: body }
}

async function readResponseText(res: Response): Promise<string> {
  const reader = res.body?.getReader()
  if (!reader) return ""

  const decoder = new TextDecoder("utf-8", { fatal: false })
  let total = 0
  let text = ""

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > MAX_BODY_BYTES) {
      await reader.cancel()
      throw new Error(`Response body exceeds ${MAX_BODY_BYTES} bytes`)
    }
    text += decoder.decode(value, { stream: true })
  }
  text += decoder.decode()
  return text
}

export async function fetchWebPage(rawUrl: string): Promise<FetchWebPageResult> {
  const fetchedAt = new Date().toISOString()
  const url = rawUrl.trim()

  try {
    const startUrl = await assertPublicHttpsUrl(url)
    let currentUrl = startUrl
    let response: Response | null = null

    for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect += 1) {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
      try {
        response = await fetch(currentUrl, {
          method: "GET",
          redirect: "manual",
          signal: controller.signal,
          headers: {
            Accept: "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8",
            "User-Agent": USER_AGENT,
          },
        })
      } finally {
        clearTimeout(timeout)
      }

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location")
        if (!location) {
          return {
            ok: false,
            url,
            fetchedAt,
            error: `Redirect ${response.status} without Location header`,
          }
        }
        const next = new URL(location, currentUrl)
        currentUrl = await assertPublicHttpsUrl(next.toString())
        continue
      }
      break
    }

    if (!response) {
      return { ok: false, url, fetchedAt, error: "No response received" }
    }

    const finalUrl = currentUrl.toString()
    const contentType = response.headers.get("content-type") ?? undefined

    if (!response.ok) {
      return {
        ok: false,
        url,
        finalUrl,
        status: response.status,
        contentType,
        fetchedAt,
        error: `HTTP ${response.status}`,
      }
    }

    const rawBody = await readResponseText(response)
    const { title, text } = htmlToPlainText(rawBody)

    if (!text) {
      return {
        ok: false,
        url,
        finalUrl,
        status: response.status,
        title: title ?? undefined,
        contentType,
        fetchedAt,
        error: "No readable text extracted from response",
      }
    }

    return {
      ok: true,
      url,
      finalUrl,
      status: response.status,
      title: title ?? undefined,
      excerpt: text,
      contentType,
      fetchedAt,
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Fetch failed"
    return { ok: false, url, fetchedAt, error: message }
  }
}
