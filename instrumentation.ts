import 'server-only'

export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  try {
    const { ensureAgentQueueWhitelistFile } = await import('@/lib/extension-storage')
    ensureAgentQueueWhitelistFile()
  } catch (e) {
    console.warn('Failed to ensure agent-queue whitelist file at startup.', e)
  }
  const g = globalThis as typeof globalThis & {
    __extMonitorHandle?: ReturnType<typeof setInterval>
    __extLookupHandle?: ReturnType<typeof setInterval>
  }
  try {
    const { prisma } = await import('@/lib/prisma')
    await prisma.$queryRaw`SELECT 1`
  } catch (e) {
    console.warn('Background services disabled: database not reachable at startup.', e)
    return
  }
  if (process.env.EXT_MONITOR_ENABLED !== '0' && !g.__extMonitorHandle) {
    const rawMinutes = Number(process.env.EXT_MONITOR_PERIOD_MINUTES ?? '30')
    const minutes = Number.isFinite(rawMinutes) && rawMinutes > 0 ? rawMinutes : 30
    const { scheduleExtensionMonitor } = await import('@/lib/monitor/extensions-monitor')
    const handle = scheduleExtensionMonitor(minutes * 60 * 1000)
    g.__extMonitorHandle = handle
  }
  if (process.env.EXT_LOOKUP_ENABLED !== '0' && !g.__extLookupHandle) {
    const seconds = Number(process.env.EXT_LOOKUP_PERIOD_SECONDS ?? '8')
    const { scheduleExtensionLookupService } = await import('@/lib/analysis-service')
    const handle = scheduleExtensionLookupService(seconds * 1000)
    g.__extLookupHandle = handle
  }
}
