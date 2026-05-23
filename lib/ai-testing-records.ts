import type { AiTestingNetworkLog } from '@/lib/ai-testing-network'

export type AiTestingRecordingStep = {
  time: string
  thinking: string
  image: string
}

export type AiTestingLatestDetail = {
  records: AiTestingRecordingStep[]
  assetBaseUrl: string
  network: AiTestingNetworkLog | null
  error: string
}

export function parseAiTestingRecordingSteps(records: unknown): AiTestingRecordingStep[] {
  if (!Array.isArray(records)) return []
  return records.flatMap((item): AiTestingRecordingStep[] => {
    if (!item || typeof item !== 'object') return []
    const obj = item as Record<string, unknown>
    const time = typeof obj.time === 'string' ? obj.time : ''
    const thinking = typeof obj.thinking === 'string' ? obj.thinking : ''
    const image = typeof obj.image === 'string' ? obj.image : ''
    if (!time || !thinking || !image) return []
    return [{ time, thinking, image }]
  })
}

export async function fetchAiTestingLatestDetail(
  extensionId: string,
  version?: string,
): Promise<AiTestingLatestDetail> {
  const url =
    version && version.length > 0
      ? `/api/ai-testing/${encodeURIComponent(extensionId)}/latest?version=${encodeURIComponent(version)}`
      : `/api/ai-testing/${encodeURIComponent(extensionId)}/latest`
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) {
    return {
      records: [],
      assetBaseUrl: '',
      network: null,
      error: 'No AI testing record found for this extension.',
    }
  }
  const json = (await res.json()) as {
    records?: unknown
    assetBaseUrl?: string
    network?: AiTestingNetworkLog | null
  }
  if (!Array.isArray(json.records)) {
    return {
      records: [],
      assetBaseUrl: '',
      network: null,
      error: 'AI testing record format is invalid.',
    }
  }
  const records = parseAiTestingRecordingSteps(json.records)
  if (records.length === 0) {
    return {
      records: [],
      assetBaseUrl: typeof json.assetBaseUrl === 'string' ? json.assetBaseUrl : '',
      network: json.network ?? null,
      error: 'AI testing record is empty.',
    }
  }
  return {
    records,
    assetBaseUrl: typeof json.assetBaseUrl === 'string' ? json.assetBaseUrl : '',
    network: json.network ?? null,
    error: '',
  }
}
