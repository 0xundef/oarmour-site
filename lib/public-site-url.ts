/** Canonical public site origin for links emailed or returned by API. */
export function getPublicSiteOrigin(req: Request): string {
  const configured = process.env.NEXTAUTH_URL?.trim()
  if (configured) {
    try {
      return new URL(configured).origin
    } catch {
      // ignore invalid NEXTAUTH_URL
    }
  }

  const forwardedHost = req.headers.get("x-forwarded-host")
  const forwardedProto = req.headers.get("x-forwarded-proto")
  if (forwardedHost) {
    const proto = forwardedProto?.split(",")[0]?.trim() || "https"
    return `${proto}://${forwardedHost.split(",")[0]?.trim()}`
  }

  const host = req.headers.get("host")
  if (host) {
    const proto =
      forwardedProto?.split(",")[0]?.trim() ||
      (host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https")
    return `${proto}://${host}`
  }

  return new URL(req.url).origin
}

export function buildInvestigationShareUrl(origin: string, shareToken: string): string {
  return `${origin.replace(/\/$/, "")}/investigation/${encodeURIComponent(shareToken)}`
}
