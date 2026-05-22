import 'server-only'
import type { Prisma, PrismaClient } from '@prisma/client'
import { prisma } from '@/lib/prisma'

type DbClient = PrismaClient | Prisma.TransactionClient

export type ExtensionVersionPointers = {
  version: string | null
  pendingVersion?: string | null
}

/** Version to download/analyze (pending target, else last detected). */
export function resolveAnalysisTargetVersion(ext: ExtensionVersionPointers): string | null {
  const pending = ext.pendingVersion?.trim()
  if (pending) return pending
  const detected = ext.version?.trim()
  return detected || null
}

/** Version string used when comparing against store/CDN latest. */
export function resolveMonitorCompareVersion(ext: ExtensionVersionPointers): string | null {
  return resolveAnalysisTargetVersion(ext)
}

export async function setPendingVersion(
  dbId: string,
  pendingVersion: string | null,
  db: DbClient = prisma,
) {
  const trimmed = pendingVersion?.trim() || null
  await db.globalExtension.update({
    where: { id: dbId },
    data: { pendingVersion: trimmed, updatedAt: new Date() },
  })
}

/** After static analysis COMPLETED: advance detected version; clear pending when it matches. */
export async function promoteDetectedVersion(
  dbId: string,
  detectedVersion: string,
  db: DbClient = prisma,
) {
  const segment = detectedVersion.trim()
  if (!segment) return

  const ext = await db.globalExtension.findUnique({
    where: { id: dbId },
    select: { pendingVersion: true },
  })
  const pending = ext?.pendingVersion?.trim()
  const clearPending = !pending || pending === segment

  await db.globalExtension.update({
    where: { id: dbId },
    data: {
      version: segment,
      ...(clearPending ? { pendingVersion: null } : {}),
      updatedAt: new Date(),
    },
  })
}
