import 'server-only'
import { logInfo } from '@/lib/app-logger'

export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  try {
    const { prisma } = await import('@/lib/prisma')
    await prisma.$queryRaw`SELECT 1`
    logInfo('[startup] database reachable')
  } catch (e) {
    logInfo('[startup] database not reachable', { error: e })
  }
}
