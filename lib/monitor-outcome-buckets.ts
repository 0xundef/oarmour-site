export type MonitorHistoryPoint = {
  id: string
  status: string
  checkedCount: number
  succeededCount: number
  failedCount: number
  updatedCount: number
  startedAt: string
  startedAtMs: number
}

export type MonitorOutcomeBucket = {
  bucketKey: string
  bucketStartMs: number
  slotLabel: string
  succeededCount: number
  failedCount: number
  runCount: number
  /** Latest run in this slot (for drill-down). */
  representativeRun: MonitorHistoryPoint | null
}

const DEFAULT_INTERVAL_MS = 30 * 60 * 1000

export function getMonitorIntervalMs(intervalMinutes?: number) {
  const minutes =
    typeof intervalMinutes === 'number' && Number.isFinite(intervalMinutes) && intervalMinutes > 0
      ? intervalMinutes
      : 30
  return minutes * 60 * 1000
}

function formatBucketLabel(ms: number) {
  return new Date(ms).toLocaleString([], {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** Fixed-width time slots; empty slots keep a place with zero counts. */
export function buildMonitorOutcomeBuckets(params: {
  history: MonitorHistoryPoint[]
  windowStartMs: number
  windowEndMs: number
  intervalMs?: number
}): MonitorOutcomeBucket[] {
  const intervalMs = params.intervalMs ?? DEFAULT_INTERVAL_MS
  const rawStart = Math.min(params.windowStartMs, params.windowEndMs)
  const end = Math.max(params.windowStartMs, params.windowEndMs)
  if (!Number.isFinite(rawStart) || !Number.isFinite(end) || end <= rawStart) return []

  const start = Math.floor(rawStart / intervalMs) * intervalMs

  const buckets: MonitorOutcomeBucket[] = []
  for (let bucketStart = start; bucketStart < end; bucketStart += intervalMs) {
    const bucketEnd = Math.min(bucketStart + intervalMs, end)
    const inBucket = params.history.filter((run) => {
      const t = run.startedAtMs
      return Number.isFinite(t) && t >= bucketStart && t < bucketEnd
    })

    let succeededCount = 0
    let failedCount = 0
    for (const run of inBucket) {
      if (run.status === 'COMPLETED') {
        succeededCount += run.succeededCount
        failedCount += run.failedCount
      } else if (run.status === 'FAILED') {
        failedCount += 1
      }
    }

    const representativeRun =
      inBucket.length > 0
        ? [...inBucket].sort((a, b) => b.startedAtMs - a.startedAtMs)[0]
        : null

    buckets.push({
      bucketKey: String(bucketStart),
      bucketStartMs: bucketStart,
      slotLabel: formatBucketLabel(bucketStart),
      succeededCount,
      failedCount,
      runCount: inBucket.length,
      representativeRun,
    })
  }

  return buckets
}
