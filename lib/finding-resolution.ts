import type { WorkbenchCheckItem } from '@/lib/workbench-check-items'

export const FINDING_DISMISSAL_REASONS = [
  { value: 'VT_FALSE_POSITIVE', label: 'VirusTotal false positive' },
  { value: 'LEGITIMATE_BUSINESS', label: 'Legitimate business / partner' },
  { value: 'WHOIS_DATA_QUALITY', label: 'WHOIS / enrichment data quality' },
  { value: 'TEST_OR_PLACEHOLDER', label: 'Test or placeholder domain' },
  { value: 'OTHER', label: 'Other' },
] as const

export type FindingDismissalReason = (typeof FINDING_DISMISSAL_REASONS)[number]['value']

export function isFindingDismissalReason(value: string): value is FindingDismissalReason {
  return FINDING_DISMISSAL_REASONS.some((r) => r.value === value)
}

export function normalizeAllowlistDomain(domain: string): string {
  return domain.trim().toLowerCase().replace(/^\.+/, '')
}

export function domainFromMaliciousFindingIssueId(issueId: string): string | null {
  const prefixes = ['static:malicious-domain:', 'ai:malicious-runtime:'] as const
  for (const prefix of prefixes) {
    if (issueId.startsWith(prefix)) {
      const domain = issueId.slice(prefix.length).trim()
      return domain ? normalizeAllowlistDomain(domain) : null
    }
  }
  return null
}

export function isMaliciousDomainFinding(item: WorkbenchCheckItem): boolean {
  return (
    item.category === 'Malicious domain' ||
    item.category === 'Malicious runtime' ||
    domainFromMaliciousFindingIssueId(item.id) !== null
  )
}

export function applyFindingResolutions(
  items: WorkbenchCheckItem[],
  params: {
    dismissedIssueIds: ReadonlySet<string>
    allowlistedDomains: ReadonlySet<string>
  },
): WorkbenchCheckItem[] {
  const { dismissedIssueIds, allowlistedDomains } = params
  return items.filter((item) => {
    if (dismissedIssueIds.has(item.id)) return false
    const domain = domainFromMaliciousFindingIssueId(item.id)
    if (domain && allowlistedDomains.has(domain)) return false
    return true
  })
}

export function partitionWorkbenchFindings(
  items: WorkbenchCheckItem[],
  params: {
    dismissedIssueIds: ReadonlySet<string>
    allowlistedDomains: ReadonlySet<string>
  },
): { open: WorkbenchCheckItem[]; closed: WorkbenchCheckItem[] } {
  const open = applyFindingResolutions(items, params)
  const closed = items.filter((item) => !open.some((o) => o.id === item.id))
  return { open, closed }
}
