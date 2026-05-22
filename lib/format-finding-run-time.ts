/** Human-readable scan batch label for finding list UI. */
export function formatFindingRunLabel(
  source: 'static' | 'ai',
  detectedAt: string | null | undefined,
): string {
  const prefix = source === 'static' ? 'Static scan' : 'AI test'
  if (!detectedAt?.trim()) return prefix
  const date = new Date(detectedAt)
  const when = Number.isFinite(date.getTime()) ? date.toLocaleString() : detectedAt.trim()
  return `${prefix} · ${when}`
}
