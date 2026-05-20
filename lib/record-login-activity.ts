import { prisma } from '@/lib/prisma'

export async function recordLoginActivity(input: {
  userId: string
  ipAddress?: string | null
  provider?: string | null
}) {
  const userId = input.userId?.trim()
  if (!userId) return

  await prisma.loginActivity.create({
    data: {
      userId,
      ipAddress: input.ipAddress?.trim() || null,
      provider: input.provider?.trim() || null,
    },
  })
}

export async function resolveUserIdForLoginLog(user: {
  id?: string | null
  email?: string | null
}): Promise<string | null> {
  if (user.id) return user.id
  const email = user.email?.trim().toLowerCase()
  if (!email) return null
  const dbUser = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  })
  return dbUser?.id ?? null
}
