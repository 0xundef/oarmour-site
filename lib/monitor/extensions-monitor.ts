import 'server-only'
import axios from 'axios'
import os from 'os'
import path from 'path'
import { randomUUID } from 'crypto'
import { prisma } from '@/lib/prisma'
import { downloadExtension } from '@/lib/extension-analyzer'
import { processExtension } from '@/lib/analysis-service'

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

function getNextVersion(version?: string | null) {
  if (!version || !/^\d+(\.\d+)*$/.test(version)) return null
  const parts = version.split('.').map((x) => parseInt(x, 10))
  parts[parts.length - 1] = (parts[parts.length - 1] ?? 0) + 1
  return parts.join('.')
}

async function hasCdnPackage(downloadUrl: string) {
  const res = await axios.get(downloadUrl, {
    responseType: 'stream',
    validateStatus: () => true,
  })
  if (res.data && typeof res.data.destroy === 'function') {
    res.data.destroy()
  }
  return res.status === 200 || res.status === 206
}

export async function monitorExtensionsOnce() {
  let runId: string | null = null
  let failedCount = 0
  let succeededCount = 0
  const monitorRunDelegate = (prisma as unknown as {
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
      await prisma.$executeRawUnsafe(
        `INSERT INTO "MonitorRun" ("id","status","startedAt","createdAt","updatedAt")
         VALUES ($1,'RUNNING',NOW(),NOW(),NOW())`,
        runId,
      )
    }
  } catch (e) {
    console.warn('Monitor: failed to create monitor run record.', e)
  }
  let list: Array<{ id: string; storeId: string; version: string | null; testingMode: boolean }>
  try {
    list = await prisma.$queryRaw<Array<{ id: string; storeId: string; version: string | null; testingMode: boolean }>>`
      SELECT "id","storeId","version","testingMode" FROM "GlobalExtension" WHERE "isMonitored" = true
    `
  } catch (e) {
    try {
      const legacyList = await prisma.$queryRaw<Array<{ id: string; storeId: string; version: string | null }>>`
        SELECT "id","storeId","version" FROM "GlobalExtension" WHERE "isMonitored" = true
      `
      list = legacyList.map((item) => ({
        ...item,
        testingMode: false,
      }))
    } catch {
      console.warn('Monitor: isMonitored flag query failed. Skipping monitoring.', e)
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
            await prisma.$executeRawUnsafe(
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
      return { checked: 0, updated: [] as Array<{ id: string; storeId: string; from?: string | null; to: string; crxPath: string }> }
    }
  }
  const updated: Array<{ id: string; storeId: string; from?: string | null; to: string; crxPath: string }> = []
  for (const ext of list) {
    try {
      if (ext.testingMode) {
        const nextVersion = getNextVersion(ext.version)
        if (!nextVersion) {
          succeededCount += 1
          continue
        }
        const downloadUrl = `https://cdn.oarmour.com/${ext.storeId}/${nextVersion}.zip`
        const available = await hasCdnPackage(downloadUrl)
        if (!available) {
          succeededCount += 1
          continue
        }
        await processExtension(ext.storeId, downloadUrl)
        updated.push({ id: ext.id, storeId: ext.storeId, from: ext.version, to: nextVersion, crxPath: downloadUrl })
        succeededCount += 1
        continue
      }
      const latest = await fetchStoreVersion(ext.storeId)
      if (!latest) continue
      if (cmpVersion(latest, ext.version) > 0) {
        const out = path.join(os.tmpdir(), 'extension-monitor', ext.storeId, 'crx')
        const crxPath = await downloadExtension(ext.storeId, out)
        try {
          await prisma.globalExtension.update({
            where: { id: ext.id },
            data: { version: latest, updatedAt: new Date() },
          })
        } catch (e) {
          console.error('Failed to update DB for', ext.storeId, e)
        }
        updated.push({ id: ext.id, storeId: ext.storeId, from: ext.version, to: latest, crxPath })
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
        await prisma.$executeRawUnsafe(
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
