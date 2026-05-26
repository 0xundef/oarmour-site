import type { BrowserAgentTaskStatus } from '@prisma/client'
import type { DynamicAnalysisDisplayStatus } from '@/lib/dynamic-analysis-display'

/** Same values as `BrowserAgentTaskSession.status` in AI test sessions table. */
export type BrowserAgentTaskUiStatus =
  | 'queued'
  | 'pending'
  | 'running'
  | 'complete'
  | 'error'
  | 'cancelled'

export function mapDbStatusToTaskUi(status: BrowserAgentTaskStatus): BrowserAgentTaskUiStatus {
  switch (status) {
    case 'QUEUED':
      return 'queued'
    case 'DISPATCHED':
      return 'pending'
    case 'RUNNING':
      return 'running'
    case 'COMPLETE':
      return 'complete'
    case 'CANCELLED':
      return 'cancelled'
    case 'ERROR':
    default:
      return 'error'
  }
}

/** Sparkle column: mirrors AI test sessions Status badges. */
export function mapTaskUiStatusToSparkle(
  status: BrowserAgentTaskUiStatus | null | undefined,
): DynamicAnalysisDisplayStatus {
  switch (status) {
    case 'queued':
    case 'pending':
    case 'running':
      return 'in_progress'
    case 'complete':
      return 'success'
    case 'error':
    case 'cancelled':
      return 'unavailable'
    default:
      return 'unavailable'
  }
}

export function mapDbStatusToSparkle(
  status: BrowserAgentTaskStatus | null | undefined,
): DynamicAnalysisDisplayStatus {
  if (!status) return 'unavailable'
  return mapTaskUiStatusToSparkle(mapDbStatusToTaskUi(status))
}
