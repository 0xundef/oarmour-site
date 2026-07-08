import 'server-only'

import { prisma } from '@/lib/prisma'
import { normalizeAllowlistDomain } from '@/lib/finding-resolution'
import { applyFindingResolutions } from '@/lib/finding-resolution'
import {
  buildWorkbenchCheckItems,
  type StaticLatestPayload,
} from '@/lib/workbench-check-items'
import type { AiTestingLatestPayload } from '@/lib/ai-testing-display'

export type FindingResolutionSnapshot = {
  dismissedIssueIds: Set<string>
  allowlistedDomains: Set<string>
  dismissals: Array<{
    issueId: string
    reason: string
    note: string | null
    extensionVersion: string | null
    createdAt: string
  }>
  allowlist: Array<{
    domain: string
    note: string | null
    createdAt: string
  }>
}

export async function loadFindingResolutionsForUser(
  userId: string,
  storeId: string,
): Promise<FindingResolutionSnapshot> {
  const [dismissals, allowlist] = await Promise.all([
    prisma.findingDismissal.findMany({
      where: { userId, storeId },
      orderBy: { createdAt: 'desc' },
      select: {
        issueId: true,
        reason: true,
        note: true,
        extensionVersion: true,
        createdAt: true,
      },
    }),
    prisma.extensionDomainAllowlist.findMany({
      where: { storeId },
      orderBy: { createdAt: 'desc' },
      select: { domain: true, note: true, createdAt: true },
    }),
  ])

  return {
    dismissedIssueIds: new Set(dismissals.map((d) => d.issueId)),
    allowlistedDomains: new Set(allowlist.map((a) => normalizeAllowlistDomain(a.domain))),
    dismissals: dismissals.map((d) => ({
      issueId: d.issueId,
      reason: d.reason,
      note: d.note,
      extensionVersion: d.extensionVersion,
      createdAt: d.createdAt.toISOString(),
    })),
    allowlist: allowlist.map((a) => ({
      domain: normalizeAllowlistDomain(a.domain),
      note: a.note,
      createdAt: a.createdAt.toISOString(),
    })),
  }
}

/**
 * Store-scoped suppression sets for the detection pipeline's deterministic
 * dedupe pre-filter (no user dimension — the pipeline is store-level).
 * Returns allowlisted apex domains for this store. `dismissedIssueIds` are
 * workbench-issue-scoped (different ID space than pipeline `dp:` findingIds),
 * so the pipeline suppresses by allowlisted domain only.
 */
export async function loadStoreSuppressions(
  storeId: string,
): Promise<{ allowlistedDomains: Set<string>; dismissedIssueIds: Set<string> }> {
  const [dismissals, allowlist] = await Promise.all([
    prisma.findingDismissal.findMany({
      where: { storeId },
      select: { issueId: true },
    }),
    prisma.extensionDomainAllowlist.findMany({
      where: { storeId },
      select: { domain: true },
    }),
  ])
  return {
    allowlistedDomains: new Set(allowlist.map((a) => normalizeAllowlistDomain(a.domain))),
    dismissedIssueIds: new Set(dismissals.map((d) => d.issueId)),
  }
}

export function countOpenHighCriticalFindings(
  params: {
    staticPayload: StaticLatestPayload | null
    aiPayload: AiTestingLatestPayload | null
  },
  resolutions: Pick<FindingResolutionSnapshot, 'dismissedIssueIds' | 'allowlistedDomains'>,
): number {
  const built = buildWorkbenchCheckItems(params).filter(
    (item) => item.severity === 'CRITICAL' || item.severity === 'HIGH',
  )
  return applyFindingResolutions(built, resolutions).length
}
