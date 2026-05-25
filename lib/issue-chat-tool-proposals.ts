import { z } from 'zod'
import { FINDING_DISMISSAL_REASONS } from '@/lib/finding-resolution'

const DISMISSAL_REASON_VALUES = FINDING_DISMISSAL_REASONS.map((r) => r.value)

export const findingDismissalReasonSchema = z.enum([
  DISMISSAL_REASON_VALUES[0],
  DISMISSAL_REASON_VALUES[1],
  DISMISSAL_REASON_VALUES[2],
  DISMISSAL_REASON_VALUES[3],
  DISMISSAL_REASON_VALUES[4],
])

export type AllowlistProposalOutput = {
  kind: 'allowlist_proposal'
  domain: string
  rationale: string
  note: string | null
  status: 'pending_confirmation' | 'cancelled'
}

export type DismissProposalOutput = {
  kind: 'dismiss_proposal'
  issueId: string
  reason: z.infer<typeof findingDismissalReasonSchema>
  rationale: string
  note: string | null
  alsoAllowlistDomain: boolean
  status: 'pending_confirmation' | 'cancelled'
}

export function dismissalReasonLabel(reason: string): string {
  return FINDING_DISMISSAL_REASONS.find((r) => r.value === reason)?.label ?? reason
}
