import 'server-only'

import type { NavItem } from '@/types'
import { prisma } from '@/lib/prisma'
import { countHighCriticalFindingsForSubscribed } from '@/lib/subscribed-finding-count'

const notificationSubscriptionModel = (prisma as unknown as {
  notificationSubscription?: {
    findMany: (...args: unknown[]) => Promise<
      Array<{
        extension: { storeId: string; name: string; version: string | null }
      }>
    >
  }
}).notificationSubscription

export async function loadSubscribedNavChildren(user: {
  id?: string | null
  email?: string | null
}): Promise<NavItem[]> {
  if (!notificationSubscriptionModel) {
    return [
      {
        title: 'No subscriptions',
        href: '/dashboard/subscribed',
        icon: 'arrowRight',
        disabled: true,
      },
    ]
  }

  const subscribedChildren = await notificationSubscriptionModel.findMany({
    where: user.email
      ? {
          user: {
            email: {
              equals: user.email.trim(),
              mode: 'insensitive',
            },
          },
        }
      : user.id
        ? { userId: user.id }
        : { userId: '__no_user__' },
    orderBy: { createdAt: 'desc' },
    select: {
      extension: {
        select: { storeId: true, name: true, version: true },
      },
    },
  })

  if (subscribedChildren.length === 0) {
    return [
      {
        title: 'No subscriptions',
        href: '/dashboard/subscribed',
        icon: 'arrowRight',
        disabled: true,
      },
    ]
  }

  return Promise.all(
    subscribedChildren.map(async (item) => ({
      title: item.extension.name || item.extension.storeId,
      href: `/dashboard/subscribed/${encodeURIComponent(item.extension.storeId)}`,
      icon: 'check' as const,
      highCriticalCount: await countHighCriticalFindingsForSubscribed(
        item.extension.storeId,
        item.extension.version,
        user.id,
      ),
    })),
  )
}
