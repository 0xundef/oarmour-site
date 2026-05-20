/** Best-effort client IP from proxy headers (Vercel, nginx, etc.). */
export function clientIpFromHeaders(headersList: { get(name: string): string | null }): string | null {
  const forwarded = headersList.get('x-forwarded-for')
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim()
    if (first) return first
  }
  const realIp = headersList.get('x-real-ip')?.trim()
  if (realIp) return realIp
  const cfIp = headersList.get('cf-connecting-ip')?.trim()
  if (cfIp) return cfIp
  return null
}
