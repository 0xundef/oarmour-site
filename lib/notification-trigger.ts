import { prisma } from '@/lib/prisma'
import { sendMaliciousAlertEmail } from '@/lib/email'
import { sendMaliciousAlertSlack, type SlackAlertResult } from '@/lib/slack'
import { logError, logInfo, logWarn } from '@/lib/app-logger'

const NEXTAUTH_URL = process.env.NEXTAUTH_URL || 'http://localhost:3000'
const notificationSubscriptionModel = (prisma as unknown as {
  notificationSubscription?: {
    findMany: (...args: unknown[]) => Promise<Array<{ userId: string; user: { email: string } }>>
  }
}).notificationSubscription

type NotificationResult = {
  attempted: number
  sent: number
  failed: number
  skipped: boolean
  reason: 'sent' | 'no_subscribers' | 'extension_not_found' | 'degraded' | 'error'
  slack: SlackAlertResult
}

export async function triggerMaliciousAlertNotifications(
  extensionId: string,
  extensionName: string,
  riskLevel: string,
  summary: string,
  maliciousDomains?: string[],
): Promise<NotificationResult> {
  const emptySlack: SlackAlertResult = { ok: true, skipped: true, reason: 'not_configured' }

  try {
    const extension = await prisma.globalExtension.findFirst({
      where: {
        OR: [{ id: extensionId }, { storeId: extensionId }],
      },
      select: { id: true, storeId: true },
    })
    if (!extension?.id || !extension.storeId?.trim()) {
      return {
        attempted: 0,
        sent: 0,
        failed: 0,
        skipped: true,
        reason: 'extension_not_found',
        slack: emptySlack,
      }
    }

    const storeId = extension.storeId.trim()
    const detectedAt = new Date()
    const viewReportUrl = `${NEXTAUTH_URL}/dashboard/subscribed/${encodeURIComponent(storeId)}`

    const slack = await sendMaliciousAlertSlack({
      extensionName,
      extensionId: storeId,
      riskLevel,
      detectedAt,
      summary,
      maliciousDomains,
      viewReportUrl,
    })

    if (!notificationSubscriptionModel) {
      return {
        attempted: 0,
        sent: 0,
        failed: 0,
        skipped: true,
        reason: 'degraded',
        slack,
      }
    }

    const subscribers = await notificationSubscriptionModel.findMany({
      where: { extensionId: extension.id },
      include: { user: { select: { email: true } } },
    })

    if (subscribers.length === 0) {
      return {
        attempted: 0,
        sent: 0,
        failed: 0,
        skipped: true,
        reason: 'no_subscribers',
        slack,
      }
    }

    const results = await Promise.all(
      subscribers.map(async (sub) => {
        const unsubscribeToken = Buffer.from(`${sub.userId}:${extension.id}:${Date.now()}`).toString('base64url')
        const unsubscribeUrl = `${NEXTAUTH_URL}/api/notifications/unsubscribe?token=${unsubscribeToken}`

        return sendMaliciousAlertEmail(sub.user.email, {
          extensionName,
          extensionId: storeId,
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
      logWarn('[notifications] some emails failed', {
        failed: failed.length,
        total: results.length,
        extensionId: storeId,
      })
    } else {
      logInfo('[notifications] alert emails sent', { count: results.length, extensionId: storeId })
    }

    return {
      attempted: results.length,
      sent: results.length - failed.length,
      failed: failed.length,
      skipped: false,
      reason: 'sent',
      slack,
    }
  } catch (e) {
    logError('[notifications] failed to trigger notifications', { error: e })
    return {
      attempted: 0,
      sent: 0,
      failed: 0,
      skipped: true,
      reason: 'error',
      slack: emptySlack,
    }
  }
}
