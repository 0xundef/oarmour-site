import 'server-only'
import type { Prisma, PrismaClient } from '@prisma/client'
import { Prisma as PrismaNamespace } from '@prisma/client'
import { prisma } from '@/lib/prisma'

type DbClient = PrismaClient | Prisma.TransactionClient

export type ExtensionPublisherVersionRow = {
  version: string
  publishedAt: string
  extensionName: string | null
}

/** Record monitor discovery of a new published version. Idempotent per (storeId, version). */
export async function recordPublisherVersionIfNew(
  params: {
    extensionId: string
    storeId: string
    version: string
    extensionName?: string | null
    publishedAt?: Date
  },
  db: DbClient = prisma,
): Promise<boolean> {
  const version = params.version.trim()
  if (!version) return false

  const publishedAt = params.publishedAt ?? new Date()
  const extensionName = params.extensionName?.trim() || null

  try {
    await db.extensionPublisherVersion.create({
      data: {
        extensionId: params.extensionId,
        storeId: params.storeId,
        extensionName,
        version,
        publishedAt,
      },
    })
    return true
  } catch (e) {
    if (
      e instanceof PrismaNamespace.PrismaClientKnownRequestError &&
      e.code === 'P2002'
    ) {
      return false
    }
    throw e
  }
}

export async function listPublisherVersionsForStore(
  storeId: string,
  db: DbClient = prisma,
): Promise<ExtensionPublisherVersionRow[]> {
  const rows = await db.extensionPublisherVersion.findMany({
    where: { storeId },
    orderBy: { publishedAt: 'desc' },
    select: { version: true, publishedAt: true, extensionName: true },
  })
  return rows.map((row) => ({
    version: row.version,
    publishedAt: row.publishedAt.toISOString(),
    extensionName: row.extensionName,
  }))
}

export async function getLatestPublisherPublishedAtByStoreIds(
  storeIds: string[],
  db: DbClient = prisma,
): Promise<Record<string, string>> {
  if (storeIds.length === 0) return {}

  const grouped = await db.extensionPublisherVersion.groupBy({
    by: ['storeId'],
    where: { storeId: { in: storeIds } },
    _max: { publishedAt: true },
  })

  const out: Record<string, string> = {}
  for (const row of grouped) {
    const max = row._max.publishedAt
    if (max) out[row.storeId] = max.toISOString()
  }
  return out
}
