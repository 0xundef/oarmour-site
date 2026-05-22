import 'server-only'
import { logInfo } from '@/lib/app-logger'

export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  const g = globalThis as typeof globalThis & {
    __extMonitorHandle?: ReturnType<typeof setInterval>
    __extLookupHandle?: ReturnType<typeof setInterval>
    __aiAnalysisHandle?: ReturnType<typeof setInterval>
  }
  try {
    const { prisma } = await import('@/lib/prisma')
    await prisma.$queryRaw`SELECT 1`
  } catch (e) {
    logInfo('[startup] background services disabled: database not reachable', { error: e })
    return
  }
  if (process.env.EXT_MONITOR_ENABLED !== '0' && !g.__extMonitorHandle) {
    const rawMinutes = Number(process.env.EXT_MONITOR_PERIOD_MINUTES ?? '30')
    const minutes = Number.isFinite(rawMinutes) && rawMinutes > 0 ? rawMinutes : 30
    const { scheduleExtensionMonitor } = await import('@/lib/monitor/extensions-monitor')
    const handle = scheduleExtensionMonitor(minutes * 60 * 1000)
    g.__extMonitorHandle = handle
    logInfo('[monitor] background scheduler started', { periodMinutes: minutes })
  }
  if (process.env.EXT_LOOKUP_ENABLED !== '0' && !g.__extLookupHandle) {
    const seconds = Number(process.env.EXT_LOOKUP_PERIOD_SECONDS ?? '8')
    const { scheduleExtensionLookupService } = await import('@/lib/analysis-service')
    const handle = scheduleExtensionLookupService(seconds * 1000)
    g.__extLookupHandle = handle
    logInfo('[analysis] lookup scheduler started', { periodSeconds: seconds })
  }
  if (process.env.AI_ANALYSIS_ENABLED !== '0' && !g.__aiAnalysisHandle) {
    const seconds = Number(process.env.AI_ANALYSIS_POLL_SECONDS ?? '15')
    const pollMs = Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : 15_000
    const { scheduleAiAnalysisService } = await import('@/lib/ai-analysis-service')
    const handle = scheduleAiAnalysisService(pollMs)
    if (handle) {
      g.__aiAnalysisHandle = handle
      logInfo('[ai-analysis] background scheduler started', { pollSeconds: seconds })
    }
  }
}
