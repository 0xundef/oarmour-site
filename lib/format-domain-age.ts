/** Display-only label from integer day count (DB / APIs still store days). */
export function formatDomainAgeDisplay(days: number): string {
  const d = Math.max(0, Math.floor(days))
  if (d >= 365) {
    return `${(d / 365).toFixed(1)}\u00a0year`
  }
  if (d >= 30) {
    return `${Math.floor(d / 30)}\u00a0month`
  }
  if (d >= 7) {
    return `${Math.floor(d / 7)}\u00a0week`
  }
  return `${d}\u00a0day`
}
