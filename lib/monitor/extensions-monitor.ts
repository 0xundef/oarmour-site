import 'server-only'
import axios from 'axios'
import { randomUUID } from 'crypto'
import type { Prisma, PrismaClient } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { enqueueExtensionLookupJob, processExtension } from '@/lib/analysis-service'
import { enqueueAgentBrowserTestTask } from '@/lib/agent-queue'
import {
  buildPackageDownloadUrl,
  getNextVersion,
  usesPrefixBasedVersionCheck,
} from '@/lib/package-download-url'

/** Stable int4 pair for pg_try_advisory_xact_lock (oarmour extension monitor). */
const EXTENSION_MONITOR_ADVISORY_KEY1 = 0x6f61726d
const EXTENSION_MONITOR_ADVISORY_KEY2 = 0x4d6f6e30

type DbClient = PrismaClient | Prisma.TransactionClient

type MonitorExtensionRow = {
  id: string
  storeId: string
  version: string | null
  packageDownloadPrefix: string | null
  packageDownloadSuffix: string | null
  aiBrowserTestingEnabled: boolean
}

export type MonitorExtensionsOnceResult = {
  checked: number
  updated: Array<{ id: string; storeId: string; from?: string | null; to: string; crxPath?: string }>
  /** Full sweep only: another instance holds the distributed lock. */
  skippedDueToConcurrentInstance?: boolean
}

function getMonitorRunDelegate(db: DbClient) {
  return (db as unknown as {
    monitorRun?: {
      create: (args: { data: { status: 'RUNNING' }, select: { id: true } }) => Promise<{ id: string }>
      update: (args: {
        where: { id: string }
        data: {
          status: 'FAILED' | 'COMPLETED'
          checkedCount?: number
          succeededCount?: number
          failedCount?: number
          updatedCount?: number
          error?: string
          endedAt: Date
        }
      }) => Promise<unknown>
    }
  }).monitorRun
}

function cmpVersion(a?: string | null, b?: string | null) {
  if (!a && !b) return 0
  if (!a) return -1
  if (!b) return 1
  const pa = a.split('.').map((x) => parseInt(x, 10))
  const pb = b.split('.').map((x) => parseInt(x, 10))
  const len = Math.max(pa.length, pb.length)
  for (let i = 0; i < len; i++) {
    const ai = pa[i] ?? 0
    const bi = pb[i] ?? 0
    if (ai > bi) return 1
    if (ai < bi) return -1
  }
  return 0
}

async function fetchStoreVersion(extensionId: string) {
  const url = `https://clients2.google.com/service/update2/crx?response=updatecheck&prodversion=131.0.0.0&acceptformat=crx3&x=id%3D${extensionId}%26v%3D0%26uc`
  const res = await axios.get(url, { responseType: 'text' })
  const body = String(res.data)
  const ok = body.includes('status="ok"')
  const m = body.match(/updatecheck[^>]*version="([\d.]+)"/)
  if (ok && m?.[1]) return m[1]
  return null
}

async function hasRemotePackage(downloadUrl: string) {
  const res = await axios.get(downloadUrl, {
    responseType: 'stream',
    validateStatus: () => true,
  })
  if (res.data && typeof res.data.destroy === 'function') {
    res.data.destroy()
  }
  return res.status === 200 || res.status === 206
}

async function loadMonitorExtensionList(
  db: DbClient,
  targetStoreId: string | undefined,
): Promise<MonitorExtensionRow[]> {
  if (targetStoreId) {
    return db.$queryRaw<MonitorExtensionRow[]>`
      SELECT "id","storeId","version","packageDownloadPrefix","packageDownloadSuffix","aiBrowserTestingEnabled"
      FROM "GlobalExtension"
      WHERE "storeId" = ${targetStoreId}
    `
  }
  return db.$queryRaw<MonitorExtensionRow[]>`
    SELECT "id","storeId","version","packageDownloadPrefix","packageDownloadSuffix","aiBrowserTestingEnabled"
    FROM "GlobalExtension"
    WHERE "isMonitored" = true
  `
}

async function monitorExtensionsOnceWithDb(
  db: DbClient,
  targetStoreId: string | undefined,
): Promise<MonitorExtensionsOnceResult> {
  let runId: string | null = null
  let failedCount = 0
  let succeededCount = 0
  const monitorRunDelegate = getMonitorRunDelegate(db)
  try {
    if (monitorRunDelegate) {
      const run = await monitorRunDelegate.create({
        data: {
          status: 'RUNNING',
        },
        select: { id: true },
      })
      runId = run.id
    } else {
      runId = randomUUID()
      await db.$executeRawUnsafe(
        `INSERT INTO "MonitorRun" ("id","status","startedAt","createdAt","updatedAt")
         VALUES ($1,'RUNNING',NOW(),NOW(),NOW())`,
        runId,
      )
    }
  } catch (e) {
    console.warn('Monitor: failed to create monitor run record.', e)
  }

  let list: MonitorExtensionRow[] = []
  try {
    list = await loadMonitorExtensionList(db, targetStoreId)
  } catch (e) {
    try {
      let legacyList: Array<{ id: string; storeId: string; version: string | null }>
      if (targetStoreId) {
        legacyList = await db.$queryRaw<Array<{ id: string; storeId: string; version: string | null }>>`
          SELECT "id","storeId","version" FROM "GlobalExtension" WHERE "storeId" = ${targetStoreId}
        `
      } else {
        legacyList = await db.$queryRaw<Array<{ id: string; storeId: string; version: string | null }>>`
          SELECT "id","storeId","version" FROM "GlobalExtension" WHERE "isMonitored" = true
        `
      }
      list = legacyList.map((item) => ({
        ...item,
        packageDownloadPrefix: null,
        packageDownloadSuffix: '.zip',
        aiBrowserTestingEnabled: false,
      }))
    } catch {
      console.warn('Monitor: extension query failed. Skipping monitoring.', e)
      if (runId) {
        try {
          if (monitorRunDelegate) {
            await monitorRunDelegate.update({
              where: { id: runId },
              data: {
                status: 'FAILED',
                checkedCount: 0,
                succeededCount: 0,
                failedCount: 0,
                updatedCount: 0,
                error: String(e),
                endedAt: new Date(),
              },
            })
          } else {
            await db.$executeRawUnsafe(
              `UPDATE "MonitorRun"
               SET "status"='FAILED',"checkedCount"=0,"succeededCount"=0,"failedCount"=0,"updatedCount"=0,"error"=$2,"endedAt"=NOW(),"updatedAt"=NOW()
               WHERE "id"=$1`,
              runId,
              String(e),
            )
          }
        } catch (updateError) {
          console.warn('Monitor: failed to update failed monitor run record.', updateError)
        }
      }
      return { checked: 0, updated: [] as Array<{ id: string; storeId: string; from?: string | null; to: string; crxPath?: string }> }
    }
  }

  const updated: Array<{ id: string; storeId: string; from?: string | null; to: string; crxPath?: string }> = []
  for (const ext of list) {
    try {
      if (usesPrefixBasedVersionCheck(ext.packageDownloadPrefix)) {
        const nextVersion = getNextVersion(ext.version)
        if (!nextVersion) {
          succeededCount += 1
          continue
        }
        const downloadUrl = buildPackageDownloadUrl(
          ext.packageDownloadPrefix!,
          nextVersion,
          ext.packageDownloadSuffix ?? '.zip',
        )
        const available = await hasRemotePackage(downloadUrl)
        if (!available) {
          succeededCount += 1
          continue
        }
        await processExtension(ext.storeId, downloadUrl)
        if (ext.aiBrowserTestingEnabled) {
          try {
            enqueueAgentBrowserTestTask({
              storeId: ext.storeId,
              version: nextVersion,
              reason: 'monitor_new_version',
            })
          } catch (e) {
            console.error('[monitor] Failed to enqueue AI testing for', ext.storeId, e)
          }
        }
        updated.push({ id: ext.id, storeId: ext.storeId, from: ext.version, to: nextVersion, crxPath: downloadUrl })
        succeededCount += 1
        continue
      }

      const latest = await fetchStoreVersion(ext.storeId)
      if (!latest) continue
      if (cmpVersion(latest, ext.version) > 0) {
        try {
          await db.globalExtension.update({
            where: { id: ext.id },
            data: { version: latest, updatedAt: new Date() },
          })
          await enqueueExtensionLookupJob(ext.id, db)
          if (ext.aiBrowserTestingEnabled) {
            try {
              enqueueAgentBrowserTestTask({
                storeId: ext.storeId,
                version: latest,
                reason: 'monitor_new_version',
              })
            } catch (e) {
              console.error('[monitor] Failed to enqueue AI testing for', ext.storeId, e)
            }
          }
        } catch (e) {
          console.error('Failed to update DB for', ext.storeId, e)
        }
        updated.push({ id: ext.id, storeId: ext.storeId, from: ext.version, to: latest })
      }
      succeededCount += 1
    } catch (e) {
      console.error('Monitor check failed for', ext.storeId, e)
      failedCount += 1
    }
  }
  if (runId) {
    try {
      if (monitorRunDelegate) {
        await monitorRunDelegate.update({
          where: { id: runId },
          data: {
            status: failedCount > 0 ? 'FAILED' : 'COMPLETED',
            checkedCount: list.length,
            succeededCount,
            failedCount,
            updatedCount: updated.length,
            endedAt: new Date(),
          },
        })
      } else {
        await db.$executeRawUnsafe(
          `UPDATE "MonitorRun"
           SET "status"=$2::"JobStatus","checkedCount"=$3,"succeededCount"=$4,"failedCount"=$5,"updatedCount"=$6,"endedAt"=NOW(),"updatedAt"=NOW()
           WHERE "id"=$1`,
          runId,
          failedCount > 0 ? 'FAILED' : 'COMPLETED',
          list.length,
          succeededCount,
          failedCount,
          updated.length,
        )
      }
    } catch (e) {
      console.warn('Monitor: failed to finalize monitor run record.', e)
    }
  }
  return { checked: list.length, updated }
}

/**
 * Runs the extension monitor. Full sweeps (no targetStoreId) use a Postgres transaction-scoped
 * advisory lock so only one instance runs at a time across processes (pool-safe).
 * Admin-scoped runs (targetStoreId set) skip the distributed lock so they can run in parallel.
 */
export async function monitorExtensionsOnce(
  targetStoreId?: string,
): Promise<MonitorExtensionsOnceResult> {
  if (targetStoreId) {
    return monitorExtensionsOnceWithDb(prisma, targetStoreId)
  }
  return prisma.$transaction(
    async (tx) => {
      const rows = await tx.$queryRaw<Array<{ ok: boolean }>>`
        SELECT pg_try_advisory_xact_lock(
          ${EXTENSION_MONITOR_ADVISORY_KEY1}::integer,
          ${EXTENSION_MONITOR_ADVISORY_KEY2}::integer
        ) AS ok
      `
      if (!rows[0]?.ok) {
        return {
          checked: 0,
          updated: [] as Array<{ id: string; storeId: string; from?: string | null; to: string; crxPath?: string }>,
          skippedDueToConcurrentInstance: true,
        }
      }
      return monitorExtensionsOnceWithDb(tx, undefined)
    },
    { maxWait: 15_000, timeout: 900_000 },
  )
}

export function scheduleExtensionMonitor(periodMs: number) {
  let running = false
  const tick = async () => {
    if (running) return
    running = true
    try {
      await monitorExtensionsOnce()
    } catch (e) {
      console.error('Monitor tick failed:', e)
    } finally {
      running = false
    }
  }
  return setInterval(tick, periodMs)
}
