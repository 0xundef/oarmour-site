export function buildClientInvestigationShareUrl(shareToken: string): string {
  if (typeof window === "undefined") return ""
  return `${window.location.origin}/investigation/${encodeURIComponent(shareToken)}`
}
