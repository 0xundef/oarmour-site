import type { AiTestingLatestPayload } from '@/lib/ai-testing-display'

export type WorkbenchCheckSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'

export type WorkbenchCheckItem = {
  id: string
  source: 'static' | 'ai'
  severity: WorkbenchCheckSeverity
  title: string
  file: string
  summary: string
  conditions: string[]
  impact: string
}

export type StaticLatestPayload = {
  addedDomains?: string[]
  topDomainSignals?: Array<{
    topDomainSignalId: string | null
    domain: string
    createTime: string | null
    isMalicious: boolean | null
  }>
  manifestPermissions?: {
    hostPermissions: string[]
    optionalHostPermissions: string[]
  }
}

function severityRank(s: WorkbenchCheckSeverity): number {
  if (s === 'CRITICAL') return 0
  if (s === 'HIGH') return 1
  if (s === 'MEDIUM') return 2
  return 3
}

function isBroadHostPermission(pattern: string): boolean {
  const p = pattern.trim().toLowerCase()
  if (!p) return false
  if (p.includes('<all_urls>')) return true
  if (p === '*://*/*' || p === '*://*/') return true
  if (p === 'http://*/*' || p === 'https://*/*' || p === 'ftp://*/*') return true
  if (p.startsWith('http://*/') || p.startsWith('https://*/')) return true
  if (p.startsWith('*://*.')) return true
  return false
}

export function buildWorkbenchCheckItems(params: {
  staticPayload: StaticLatestPayload | null
  aiPayload: AiTestingLatestPayload | null
}): WorkbenchCheckItem[] {
  const items: WorkbenchCheckItem[] = []
  const { staticPayload, aiPayload } = params

  if (staticPayload?.manifestPermissions) {
    const host = staticPayload.manifestPermissions.hostPermissions || []
    const optHost = staticPayload.manifestPermissions.optionalHostPermissions || []
    const broad = [...host, ...optHost].filter(isBroadHostPermission)
    if (broad.length > 0) {
      items.push({
        id: 'static:broad-host-permissions',
        source: 'static',
        severity: 'HIGH',
        title: 'Broad host permissions in manifest',
        file: 'manifest.json',
        summary: `The extension declares ${broad.length} host permission pattern(s) with very wide scope (e.g. wildcards or all_urls). Examples: ${broad.slice(0, 3).join('; ')}${broad.length > 3 ? '…' : ''}`,
        conditions: [
          'Patterns match many origins beyond a single vendor domain.',
          'User grants or accepts default permission prompts.',
        ],
        impact:
          'Larger attack surface for content scripts and elevated data exposure if the extension is compromised.',
      })
    }
  }

  for (const signal of staticPayload?.topDomainSignals ?? []) {
    if (signal.isMalicious === true) {
      const age = signal.createTime ? ` Domain registration context: ${signal.createTime}.` : ''
      items.push({
        id: `static:malicious-domain:${signal.domain}`,
        source: 'static',
        severity: 'CRITICAL',
        title: `Malicious indicator: apex domain ${signal.domain}`,
        file: 'extension package (static scan)',
        summary: `Static analysis flagged this apex domain as malicious (VirusTotal / enrichment pipeline).${age}`,
        conditions: [
          'Domain appears in extension package or declared surface.',
          'Threat intel enrichment marked the domain as malicious.',
        ],
        impact: 'May indicate phishing, C2, or untrusted third-party infrastructure referenced by the extension.',
      })
    } else if (signal.isMalicious === false && signal.domain) {
      items.push({
        id: `static:new-domain:${signal.domain}`,
        source: 'static',
        severity: 'LOW',
        title: `Newly observed domain: ${signal.domain}`,
        file: 'extension package (static scan)',
        summary:
          'This apex domain is new compared to the previous completed static analysis; current intel did not mark it malicious.',
        conditions: ['Extension was upgraded or rescanned.', 'Domain appeared in the latest static domain set.'],
        impact: 'Informational; monitor for future reputation changes.',
      })
    }
  }

  const ai = aiPayload?.aiAnalysis

  if (ai?.status === 'FAILED') {
    items.push({
      id: 'ai:analysis-failed',
      source: 'ai',
      severity: 'HIGH',
      title: 'AI runtime analysis failed',
      file: 'network.json',
      summary: ai.error || 'Runtime network log was missing or invalid; AI domain diff / enrichment could not complete.',
      conditions: ['Browser test completed but network.json was absent or malformed.', 'Downstream AI analysis job recorded FAILED.'],
      impact: 'Runtime exposure is unknown until capture_network_traffic succeeds and analysis is re-run.',
    })
  }

  if (aiPayload?.status === 'error') {
    items.push({
      id: 'ai:browser-error',
      source: 'ai',
      severity: 'HIGH',
      title: 'AI browser test reported error',
      file: 'agent status',
      summary: 'The queued browser agent finished with an error status before a complete AI testing artifact set was produced.',
      conditions: ['Agent status.json reports error for this extension/version.'],
      impact: 'No reliable runtime procedure or network capture for this run.',
    })
  }

  for (const row of ai?.domainEnrichments ?? []) {
    if (row.isMalicious === true && row.domain) {
      items.push({
        id: `ai:malicious-runtime:${row.domain}`,
        source: 'ai',
        severity: 'CRITICAL',
        title: `Malicious runtime domain: ${row.domain}`,
        file: 'network.json',
        summary:
          'This apex domain appeared in Fetch/XHR/WebSocket traffic during AI browser testing and was not in the same-batch static domain set; enrichment flagged it malicious.',
        conditions: [
          'Network capture included the host during the automated test.',
          'Domain was classified as novel vs static for that run.',
        ],
        impact: 'Potential unexpected third-party communication or compromised dependency at runtime.',
      })
    }
  }

  if (ai?.status === 'COMPLETED' && (ai.novelDomains?.length ?? 0) > 0) {
    const maliciousAi = (ai.domainEnrichments ?? []).filter((r) => r.isMalicious === true).length
    if (maliciousAi === 0) {
      items.push({
        id: 'ai:novel-non-malicious',
        source: 'ai',
        severity: 'LOW',
        title: 'Novel runtime domains without malicious verdict',
        file: 'network.json',
        summary: `${ai.novelDomains!.length} apex domain(s) appeared at runtime that were not in the static baseline for this batch; none were flagged malicious after enrichment.`,
        conditions: ['AI analysis completed successfully.', 'Novel domain list is non-empty.'],
        impact: 'Informational; review if unexpected business partners or RPC endpoints.',
      })
    }
  }

  if (ai?.status === 'COMPLETED' && (ai.novelDomains?.length ?? 0) === 0 && (ai.runtimeDomains?.length ?? 0) > 0) {
    items.push({
      id: 'ai:runtime-aligned-static',
      source: 'ai',
      severity: 'LOW',
      title: 'Runtime traffic aligned with static baseline',
      file: 'network.json',
      summary: `Captured ${ai.runtimeDomains!.length} runtime apex domain(s); none were novel versus the linked static analysis.`,
      conditions: ['network.json present and parsed.', 'AI analysis completed.'],
      impact: 'No new hosts beyond static expectations from this smoke test.',
    })
  }

  items.sort((a, b) => {
    const d = severityRank(a.severity) - severityRank(b.severity)
    if (d !== 0) return d
    return a.id.localeCompare(b.id)
  })

  return items
}
