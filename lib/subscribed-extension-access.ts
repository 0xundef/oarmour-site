import { prisma } from '@/lib/prisma'

export async function assertSubscribedToExtension(params: {
  userId: string
  email?: string | null
  storeId: string
}): Promise<{ ok: true } | { ok: false; status: 403 }> {
  const { userId, email, storeId } = params
  const emailNorm = email?.trim()
  const subscription = await prisma.notificationSubscription.findFirst({
    where: {
      extension: { storeId },
      OR: [
        { userId },
        ...(emailNorm
          ? [
              {
                user: {
                  email: { equals: emailNorm, mode: 'insensitive' as const },
                },
              },
            ]
          : []),
      ],
    },
    select: { id: true },
  })
  if (!subscription) return { ok: false, status: 403 }
  return { ok: true }
}
