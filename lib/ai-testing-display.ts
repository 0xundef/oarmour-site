export type AiTestingDomainEnrichment = {
  domain: string
  isMalicious?: boolean | null
  createdDate?: string | Date | null
}

export type AiTestingLatestAnalysis = {
  status: string
  error?: string | null
  riskLevel?: string | null
  runtimeDomains?: string[]
  novelDomains?: string[]
  networkRequestCount?: number | null
  networkCapturedAt?: string | Date | null
  createdAt?: string | Date | null
  updatedAt?: string | Date | null
  domainEnrichments?: AiTestingDomainEnrichment[]
}

export type AiTestingLatestPayload = {
  records?: unknown[]
  network?: { requestCount?: number } | null
  aiAnalysis?: AiTestingLatestAnalysis | null
  status?: string | null
  statusTime?: string | null
  runId?: string
  version?: string
}

export type AiTestingNovelDomainRow = {
  domain: string
  createTime: string | null
  isMalicious: boolean | null
}

export function enrichmentCreateTimeIso(value: string | Date | null | undefined): string | null {
  if (!value) return null
  if (typeof value === 'string') {
    const d = new Date(value)
    return Number.isNaN(d.getTime()) ? null : d.toISOString()
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString()
  return null
}

/** Runtime apex domains not present in the same-batch static domain set (not vs previous version). */
export function listNovelRuntimeDomainSignals(
  payload: AiTestingLatestPayload | null,
  limit = 10,
): AiTestingNovelDomainRow[] {
  const ai = payload?.aiAnalysis
  const novel = ai?.novelDomains ?? []
  if (novel.length === 0) return []

  const enrichByDomain = new Map(
    (ai?.domainEnrichments ?? []).map((row) => {
      const domain = row.domain?.trim()
      return domain ? [domain.toLowerCase(), row] as const : null
    }).filter((entry): entry is readonly [string, AiTestingDomainEnrichment] => entry !== null),
  )

  return novel
    .map((d) => (typeof d === 'string' ? d.trim() : ''))
    .filter((d) => d.length > 0)
    .slice(0, limit)
    .map((domain) => {
      const enrichment = enrichByDomain.get(domain.toLowerCase())
      return {
        domain,
        createTime: enrichmentCreateTimeIso(enrichment?.createdDate),
        isMalicious:
          typeof enrichment?.isMalicious === 'boolean' ? enrichment.isMalicious : null,
      }
    })
}

export type AiTestingSummary = {
  hasRun: boolean
  runId: string | null
  version: string | null
  agentStatus: string | null
  analysisStatus: string | null
  analysisError: string | null
  recordingSteps: number
  networkRequestCount: number
  runtimeDomainCount: number
  novelDomainCount: number
  maliciousSignalCount: number
  verdict: string
}

export function buildAiTestingSummary(payload: AiTestingLatestPayload | null): AiTestingSummary {
  const empty: AiTestingSummary = {
    hasRun: false,
    runId: null,
    version: null,
    agentStatus: null,
    analysisStatus: null,
    analysisError: null,
    recordingSteps: 0,
    networkRequestCount: 0,
    runtimeDomainCount: 0,
    novelDomainCount: 0,
    maliciousSignalCount: 0,
    verdict: 'No AI testing run yet',
  }
  if (!payload) return empty

  const recordingSteps = Array.isArray(payload.records) ? payload.records.length : 0
  const ai = payload.aiAnalysis ?? null
  const agentStatus = payload.status ?? null
  const analysisStatus = ai?.status ?? null
  const analysisError = ai?.error ?? null
  const networkRequestCount =
    typeof ai?.networkRequestCount === 'number'
      ? ai.networkRequestCount
      : typeof payload.network?.requestCount === 'number'
        ? payload.network.requestCount
        : 0
  const runtimeDomainCount = ai?.runtimeDomains?.length ?? 0
  const novelDomainCount = ai?.novelDomains?.length ?? 0
  const maliciousSignalCount =
    ai?.domainEnrichments?.filter((row) => row.isMalicious === true).length ?? 0

  let verdict = 'No AI testing run yet'
  if (agentStatus === 'pending' || agentStatus === 'running') {
    verdict = 'Browser test in progress'
  } else if (agentStatus === 'error') {
    verdict = 'Browser test failed'
  } else if (analysisStatus === 'FAILED') {
    verdict = analysisError || 'AI analysis failed (network capture missing)'
  } else if (analysisStatus === 'RUNNING') {
    verdict = 'Analyzing runtime network traffic'
  } else if (analysisStatus === 'COMPLETED') {
    if (ai?.riskLevel === 'HIGH' || ai?.riskLevel === 'CRITICAL') {
      verdict = 'Potentially malicious runtime domains detected'
    } else if (ai?.riskLevel === 'CAUTION') {
      verdict = 'Suspicious runtime indicators found'
    } else if (maliciousSignalCount > 0) {
      verdict = 'Potentially malicious runtime domains detected'
    } else {
      verdict = 'No high-risk runtime indicators detected'
    }
  } else if (agentStatus === 'complete') {
    verdict = 'Awaiting runtime analysis'
  }

  return {
    hasRun: true,
    runId: payload.runId ?? null,
    version: payload.version ?? null,
    agentStatus,
    analysisStatus,
    analysisError,
    recordingSteps,
    networkRequestCount,
    runtimeDomainCount,
    novelDomainCount,
    maliciousSignalCount,
    verdict,
  }
}
