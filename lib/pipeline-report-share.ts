import { randomBytes } from "crypto"
import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { getLatestPipelineRunState } from "@/lib/detection-pipeline/storage"

export type PipelineReportSharePayload = {
  shareToken: string
  storeId: string
  extensionName: string | null
  version: string | null
  runId: string
  reportMarkdown: string
  createdAt: string
  expiresAt: string | null
}

export function createShareToken(): string {
  return randomBytes(24).toString("base64url")
}

export function isValidShareToken(token: string): boolean {
  return /^[A-Za-z0-9_-]{16,64}$/.test(token)
}

/**
 * Create a read-only share of the latest completed pipeline report for a store.
 * Returns null when there is no completed report to share.
 */
export async function createPipelineReportShare(input: {
  userId: string
  storeId: string
  expiresInDays?: number
}): Promise<{ shareToken: string; runId: string } | null> {
  const state = getLatestPipelineRunState(input.storeId)
  if (!state || state.status !== "completed" || !state.markdown) {
    return null
  }

  const extension = await prisma.globalExtension.findFirst({
    where: { storeId: input.storeId },
    select: { name: true, version: true },
  })

  const shareToken = createShareToken()
  const expiresAt = input.expiresInDays
    ? new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000)
    : null

  await prisma.pipelineReportShare.create({
    data: {
      shareToken,
      createdByUserId: input.userId,
      storeId: input.storeId,
      extensionName: extension?.name ?? null,
      version: extension?.version ?? null,
      runId: state.runId,
      reportMarkdown: state.markdown,
      expiresAt,
    },
  })

  return { shareToken, runId: state.runId }
}

/** Load a share payload for public display. Returns null when invalid or expired. */
export async function loadPipelineReportShare(
  shareToken: string,
): Promise<PipelineReportSharePayload | null> {
  const row = await prisma.pipelineReportShare.findUnique({
    where: { shareToken },
    select: {
      shareToken: true,
      storeId: true,
      extensionName: true,
      version: true,
      runId: true,
      reportMarkdown: true,
      createdAt: true,
      expiresAt: true,
    },
  })
  if (!row) return null
  if (row.expiresAt && row.expiresAt.getTime() < Date.now()) return null
  return {
    shareToken: row.shareToken,
    storeId: row.storeId,
    extensionName: row.extensionName,
    version: row.version,
    runId: row.runId,
    reportMarkdown: row.reportMarkdown,
    createdAt: row.createdAt.toISOString(),
    expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
  }
}

/** Deleting a share (by owner or admin) so a link can be revoked. */
export async function deletePipelineReportShare(input: {
  shareToken: string
  userId: string
}): Promise<{ deleted: boolean }> {
  const result = await prisma.pipelineReportShare.deleteMany({
    where: { shareToken: input.shareToken, createdByUserId: input.userId },
  })
  return { deleted: result.count > 0 }
}
