const EXT_ID_REGEX = /^[a-z]{32}$/

const CHROME_CRX_HOSTS = new Set([
  'clients2.google.com',
  'clients2.googleusercontent.com',
])

const CHROME_WEB_STORE_HOSTS = [
  'chromewebstore.google.com',
  'chrome.google.com',
]

export type ParsedAnalyzeInput = {
  extensionId: string
  downloadUrl?: string
  /** Set when first download should persist a versioned package prefix (CDN). */
  packageDownloadPrefix?: string
  packageDownloadSuffix?: string
}

export function getDefaultChromeCrxDownloadUrl(extensionId: string): string {
  return `https://clients2.google.com/service/update2/crx?response=redirect&prodversion=131.0.0.0&acceptformat=crx2,crx3&x=id%3D${extensionId}%26uc`
}

function isChromeWebStoreHost(host: string): boolean {
  const h = host.toLowerCase()
  return CHROME_WEB_STORE_HOSTS.some((allowed) => h === allowed || h.endsWith(`.${allowed}`))
}

function isChromeCrxDownloadHost(host: string): boolean {
  return CHROME_CRX_HOSTS.has(host.toLowerCase())
}

function isOarmourCdnHost(host: string): boolean {
  return host.toLowerCase() === 'cdn.oarmour.com'
}

/** Allowed download URL hosts: Chrome CRX/update endpoints or cdn.oarmour.com only. */
export function isAllowedPackageDownloadUrl(url: string): boolean {
  try {
    const parsed = new URL(url.trim())
    if (!['http:', 'https:'].includes(parsed.protocol)) return false
    const host = parsed.hostname.toLowerCase()
    return isChromeCrxDownloadHost(host) || isOarmourCdnHost(host)
  } catch {
    return false
  }
}

/**
 * Derive a versioned package prefix from a concrete download URL (first submit only).
 * CDN: https://cdn.oarmour.com/{storeId}/2.0.0.zip -> prefix + suffix
 * Chrome CRX URLs are not prefix-based; returns null.
 */
export function derivePackageDownloadPrefixFromUrl(
  downloadUrl: string,
  storeId: string,
): { prefix: string; suffix: string } | null {
  if (!isAllowedPackageDownloadUrl(downloadUrl)) return null
  try {
    const parsed = new URL(downloadUrl.trim())
    const host = parsed.hostname.toLowerCase()
    if (isChromeCrxDownloadHost(host)) return null

    if (isOarmourCdnHost(host)) {
      const pathMatch = parsed.pathname.match(/^\/([a-z]{32})\/([^/]+)$/)
      if (!pathMatch || pathMatch[1] !== storeId) return null
      const filename = pathMatch[2]
      const versionMatch = filename.match(/^(.+)\.(zip|crx)$/i)
      if (!versionMatch) return null
      const suffix = `.${versionMatch[2].toLowerCase()}`
      const prefix = `${parsed.origin}/${storeId}/`
      return { prefix, suffix }
    }
  } catch {
    return null
  }
  return null
}

export function usesPrefixBasedVersionCheck(prefix: string | null | undefined): boolean {
  return typeof prefix === 'string' && prefix.trim().length > 0
}

export function buildPackageDownloadUrl(
  prefix: string,
  version: string,
  suffix = '.zip',
): string {
  const normalizedPrefix = prefix.endsWith('/') ? prefix : `${prefix}/`
  const normalizedSuffix = suffix.startsWith('.') ? suffix : `.${suffix}`
  return `${normalizedPrefix}${version}${normalizedSuffix}`
}

export function getNextVersion(version?: string | null): string | null {
  if (!version || !/^\d+(\.\d+)*$/.test(version)) return null
  const parts = version.split('.').map((x) => Number.parseInt(x, 10))
  parts[parts.length - 1] = (parts[parts.length - 1] ?? 0) + 1
  return parts.join('.')
}

export function resolveAnalyzeInput(input: string): ParsedAnalyzeInput | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  if (EXT_ID_REGEX.test(trimmed)) {
    return { extensionId: trimmed }
  }

  try {
    const url = new URL(trimmed)
    const host = url.hostname.toLowerCase()
    const path = url.pathname

    if (isChromeWebStoreHost(host) && path.includes('/detail/')) {
      const match = path.match(/[a-z]{32}/)
      if (match) return { extensionId: match[0] }
    }

    if (isAllowedPackageDownloadUrl(trimmed)) {
      const cdnMatch = path.match(/^\/([a-z]{32})\/([^/]+)$/)
      if (cdnMatch && isOarmourCdnHost(host)) {
        const derived = derivePackageDownloadPrefixFromUrl(trimmed, cdnMatch[1])
        return {
          extensionId: cdnMatch[1],
          downloadUrl: trimmed,
          packageDownloadPrefix: derived?.prefix,
          packageDownloadSuffix: derived?.suffix,
        }
      }
      if (isChromeCrxDownloadHost(host)) {
        const idMatch = url.searchParams.get('x')?.match(/[a-z]{32}/) ?? trimmed.match(/[a-z]{32}/)
        if (idMatch) {
          const extensionId = idMatch[0]
          return { extensionId, downloadUrl: trimmed }
        }
      }
    }
  } catch {
    return null
  }

  return null
}

export function extractExtensionIdFromInput(input: string): string | null {
  return resolveAnalyzeInput(input)?.extensionId ?? null
}

export function buildDashboardDownloadUrl(
  storeId: string,
  version: string,
  packageDownloadPrefix: string | null | undefined,
  packageDownloadSuffix: string | null | undefined,
): string {
  if (usesPrefixBasedVersionCheck(packageDownloadPrefix) && version && version !== 'N/A') {
    return buildPackageDownloadUrl(
      packageDownloadPrefix!,
      version,
      packageDownloadSuffix ?? '.zip',
    )
  }
  return getDefaultChromeCrxDownloadUrl(storeId)
}
