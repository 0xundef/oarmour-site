import 'server-only'
import { prisma } from '@/lib/prisma'

export async function isUserDisabled(userId: string): Promise<boolean> {
  const row = await prisma.user.findUnique({
    where: { id: userId },
    select: { disabled: true },
  })
  return row?.disabled === true
}

export async function isUserDisabledByEmail(email: string): Promise<boolean> {
  const normalized = email.trim().toLowerCase()
  if (!normalized) return false
  const row = await prisma.user.findUnique({
    where: { email: normalized },
    select: { disabled: true },
  })
  return row?.disabled === true
}
