import 'server-only'
import axios from 'axios'
import os from 'os'
import path from 'path'
import { prisma } from '@/lib/prisma'
import { downloadExtension } from '@/lib/extension-analyzer'

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

export async function monitorExtensionsOnce() {
  let list: Array<{ id: string; storeId: string; version: string | null }>
  try {
    list = await (prisma as any).globalExtension.findMany({
      where: { isMonitored: true },
      select: { id: true, storeId: true, version: true },
    })
  } catch (e) {
    console.warn('Monitor: isMonitored flag not available or DB error. Skipping monitoring.', e)
    return { checked: 0, updated: [] as Array<{ id: string; storeId: string; from?: string | null; to: string; crxPath: string }> }
  }
  const updated: Array<{ id: string; storeId: string; from?: string | null; to: string; crxPath: string }> = []
  for (const ext of list) {
    try {
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
    } catch (e) {
      console.error('Monitor check failed for', ext.storeId, e)
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
  tick()
  return setInterval(tick, periodMs)
}
