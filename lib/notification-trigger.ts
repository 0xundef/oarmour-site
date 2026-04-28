import { prisma } from '@/lib/prisma'
import { sendMaliciousAlertEmail } from '@/lib/email'

const NEXTAUTH_URL = process.env.NEXTAUTH_URL || 'http://localhost:3000'
const notificationSubscriptionModel = (prisma as unknown as {
  notificationSubscription?: {
    findMany: (...args: unknown[]) => Promise<Array<{ userId: string; user: { email: string } }>>
  }
}).notificationSubscription

export async function triggerMaliciousAlertNotifications(
  extensionId: string,
  extensionName: string,
  riskLevel: string,
  summary: string,
  maliciousDomains?: string[],
) {
  try {
    if (!notificationSubscriptionModel) {
      return { attempted: 0, sent: 0, failed: 0, skipped: true as const, reason: 'degraded' as const }
    }
    const extension = await prisma.globalExtension.findFirst({
      where: {
        OR: [{ id: extensionId }, { storeId: extensionId }],
      },
      select: { id: true },
    })
    if (!extension?.id) {
      return { attempted: 0, sent: 0, failed: 0, skipped: true as const, reason: 'extension_not_found' as const }
    }

    const subscribers = await notificationSubscriptionModel.findMany({
      where: { extensionId: extension.id },
      include: { user: { select: { email: true } } },
    })

    if (subscribers.length === 0) {
      return { attempted: 0, sent: 0, failed: 0, skipped: true as const, reason: 'no_subscribers' as const }
    }

    const detectedAt = new Date()
    const viewReportUrl = `${NEXTAUTH_URL}/dashboard/extension?id=${encodeURIComponent(extensionId)}`

    const results = await Promise.all(
      subscribers.map(async (sub) => {
        const unsubscribeToken = Buffer.from(`${sub.userId}:${extension.id}:${Date.now()}`).toString('base64url')
        const unsubscribeUrl = `${NEXTAUTH_URL}/api/notifications/unsubscribe?token=${unsubscribeToken}`

        return sendMaliciousAlertEmail(sub.user.email, {
          extensionName,
          extensionId,
          riskLevel,
          detectedAt,
          summary,
          maliciousDomains,
          viewReportUrl,
          unsubscribeUrl,
        })
      }),
    )

    const failed = results.filter((r) => !r.ok)
    if (failed.length > 0) {
      console.warn(`[notifications] ${failed.length}/${results.length} emails failed`)
    } else {
      console.warn(`[notifications] Sent ${results.length} alert emails for ${extensionId}`)
    }
    return {
      attempted: results.length,
      sent: results.length - failed.length,
      failed: failed.length,
      skipped: false as const,
      reason: 'sent' as const,
    }
  } catch (e) {
    console.error('[notifications] Failed to trigger notifications:', e)
    return { attempted: 0, sent: 0, failed: 0, skipped: true as const, reason: 'error' as const }
  }
}
