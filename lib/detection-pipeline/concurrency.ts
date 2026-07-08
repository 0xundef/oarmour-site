/**
 * Bounded-concurrency mapper. Cloned from the (module-private) `mapWithConcurrency`
 * in `lib/domain-enrichment.ts` so the detection pipeline does not depend on a
 * private export. Preserves result ordering.
 */
export async function mapWithConcurrencyLimit<T, R>(
  items: T[],
  limit: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const safeLimit = Math.max(1, Math.floor(limit))
  const results = new Array<R>(items.length)
  let cursor = 0
  const workers = Array.from({ length: Math.min(safeLimit, items.length) }, async () => {
    while (true) {
      const current = cursor++
      if (current >= items.length) return
      results[current] = await mapper(items[current], current)
    }
  })
  await Promise.all(workers)
  return results
}
