import type { UIMessage } from "ai"
import { safeValidateUIMessages } from "ai"
import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"

export function parseIssueChatScope(params: {
  storeId: unknown
  issueId: unknown
}): { storeId: string; issueId: string } | null {
  const storeId = typeof params.storeId === "string" ? params.storeId.trim() : ""
  const issueId = typeof params.issueId === "string" ? params.issueId.trim() : ""
  if (!storeId || !issueId) return null
  return { storeId, issueId }
}

export async function parseStoredUIMessages(raw: unknown): Promise<UIMessage[] | null> {
  if (!Array.isArray(raw)) return null
  const result = await safeValidateUIMessages({ messages: raw as UIMessage[] })
  if (!result.success) return null
  return result.data
}

export async function loadIssueInvestigationMessages(params: {
  userId: string
  storeId: string
  issueId: string
}): Promise<UIMessage[] | null> {
  const row = await prisma.issueInvestigationChat.findUnique({
    where: {
      userId_storeId_issueId: {
        userId: params.userId,
        storeId: params.storeId,
        issueId: params.issueId,
      },
    },
    select: { messages: true },
  })
  if (!row) return null
  return parseStoredUIMessages(row.messages)
}

export async function deleteIssueInvestigationChat(params: {
  userId: string
  storeId: string
  issueId: string
}): Promise<boolean> {
  const result = await prisma.issueInvestigationChat.deleteMany({
    where: {
      userId: params.userId,
      storeId: params.storeId,
      issueId: params.issueId,
    },
  })
  return result.count > 0
}

export async function saveIssueInvestigationMessages(params: {
  userId: string
  storeId: string
  issueId: string
  messages: UIMessage[]
}): Promise<void> {
  const validated = await safeValidateUIMessages({ messages: params.messages })
  if (!validated.success) {
    throw new Error("Invalid chat messages")
  }

  await prisma.issueInvestigationChat.upsert({
    where: {
      userId_storeId_issueId: {
        userId: params.userId,
        storeId: params.storeId,
        issueId: params.issueId,
      },
    },
    create: {
      userId: params.userId,
      storeId: params.storeId,
      issueId: params.issueId,
      messages: validated.data as unknown as Prisma.InputJsonValue,
    },
    update: {
      messages: validated.data as unknown as Prisma.InputJsonValue,
    },
  })
}
