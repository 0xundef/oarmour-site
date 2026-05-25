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

export type FindingListResolution = 'active' | 'dismissed' | 'allowlisted'

export function getFindingListResolution(
  item: WorkbenchCheckItem,
  params: {
    dismissedIssueIds: ReadonlySet<string>
    allowlistedDomains: ReadonlySet<string>
  },
): FindingListResolution {
  if (params.dismissedIssueIds.has(item.id)) return 'dismissed'
  const domain = domainFromMaliciousFindingIssueId(item.id)
  if (domain && params.allowlistedDomains.has(domain)) return 'allowlisted'
  return 'active'
}

export function isFindingResolved(
  item: WorkbenchCheckItem,
  params: {
    dismissedIssueIds: ReadonlySet<string>
    allowlistedDomains: ReadonlySet<string>
  },
): boolean {
  return getFindingListResolution(item, params) !== 'active'
}

/** Horizontal strike through severity badge (false positive / allowlisted). */
export const SEVERITY_BADGE_STRIKE_CLASS =
  "relative overflow-hidden after:pointer-events-none after:absolute after:inset-x-0.5 after:top-1/2 after:h-[1.5px] after:-translate-y-1/2 after:bg-white/90 after:content-['']"

const RESOLUTION_SORT_ORDER: Record<FindingListResolution, number> = {
  active: 0,
  allowlisted: 1,
  dismissed: 2,
}

export function sortWorkbenchFindingList(
  items: WorkbenchCheckItem[],
  params: {
    dismissedIssueIds: ReadonlySet<string>
    allowlistedDomains: ReadonlySet<string>
  },
): WorkbenchCheckItem[] {
  return [...items].sort(
    (a, b) =>
      RESOLUTION_SORT_ORDER[getFindingListResolution(a, params)] -
      RESOLUTION_SORT_ORDER[getFindingListResolution(b, params)],
  )
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
