import 'server-only'

export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  if (process.env.EXT_MONITOR_ENABLED === '0') return
  const g = globalThis as any
  if (g.__extMonitorHandle) return
  try {
    const { prisma } = await import('@/lib/prisma')
    await prisma.$queryRaw`SELECT 1`
  } catch (e) {
    console.warn('Monitor disabled: database not reachable at startup.', e)
    return
  }
  const minutes = Number(process.env.EXT_MONITOR_PERIOD_MINUTES ?? '30')
  const { scheduleExtensionMonitor } = await import('@/lib/monitor/extensions-monitor')
  const handle = scheduleExtensionMonitor(minutes * 60 * 1000)
  g.__extMonitorHandle = handle
}
