import { randomBytes } from "crypto"
import type { UIMessage } from "ai"
import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { parseStoredUIMessages } from "@/lib/issue-investigation-chat"
import { isContextSeedMessage } from "@/lib/issue-chat-messages"
import type { WorkbenchCheckItem } from "@/lib/workbench-check-items"

export type IssueInvestigationSharePayload = {
  shareToken: string
  storeId: string
  issueId: string
  issue: WorkbenchCheckItem
  extensionName: string | null
  messages: UIMessage[]
  createdAt: string
}

export function createShareToken(): string {
  return randomBytes(24).toString("base64url")
}

export function isValidShareToken(token: string): boolean {
  return /^[A-Za-z0-9_-]{16,64}$/.test(token)
}

export function parseWorkbenchCheckItem(raw: unknown): WorkbenchCheckItem | null {
  if (!raw || typeof raw !== "object") return null
  const o = raw as Record<string, unknown>
  const severity = o.severity
  const source = o.source
  if (
    typeof o.id !== "string" ||
    typeof o.title !== "string" ||
    typeof o.file !== "string" ||
    typeof o.summary !== "string" ||
    typeof o.impact !== "string" ||
    typeof o.category !== "string" ||
    (source !== "static" && source !== "ai") ||
    (severity !== "CRITICAL" &&
      severity !== "HIGH" &&
      severity !== "MEDIUM" &&
      severity !== "LOW") ||
    !Array.isArray(o.conditions) ||
    !o.conditions.every((c) => typeof c === "string")
  ) {
    return null
  }
  return {
    id: o.id,
    source,
    category: o.category,
    severity,
    title: o.title,
    file: o.file,
    summary: o.summary,
    conditions: o.conditions,
    impact: o.impact,
  }
}

/** Strip internal server paths from tool outputs before public display. */
export function sanitizeMessagesForPublic(messages: UIMessage[]): UIMessage[] {
  const pathPatterns = [
    /\/data\/chrome-extension-analyzer\/[^\s"'`]+/gi,
    /EXTENSION_STORAGE_ROOT[^\n]*/gi,
    /Unpacked extension not found at [^\n]+/gi,
  ]

  return messages.map((message) => ({
    ...message,
    parts: message.parts.map((part) => {
      if (!part || typeof part !== "object" || !("type" in part)) return part
      const type = String((part as { type: unknown }).type)
      if (!type.startsWith("tool-") || !("output" in part)) return part

      const clone = { ...part } as { output?: unknown; [key: string]: unknown }
      if (clone.output && typeof clone.output === "object") {
        const output = { ...(clone.output as Record<string, unknown>) }
        if (Array.isArray(output.notes)) {
          output.notes = output.notes
            .map((note) =>
              typeof note === "string"
                ? pathPatterns.reduce((s, re) => s.replace(re, "[redacted]"), note).trim()
                : note,
            )
            .filter((note) => typeof note === "string" && note.length > 0 && note !== "[redacted]")
        }
        if (typeof output.extensionRoot === "string") delete output.extensionRoot
        clone.output = output
      }
      return clone as typeof part
    }),
  }))
}

export function filterMessagesForShare(
  allMessages: UIMessage[],
  selectedIds: string[],
): UIMessage[] {
  const selected = new Set(selectedIds)
  const ordered = allMessages.filter(
    (message) => isContextSeedMessage(message) || selected.has(message.id),
  )
  const context = ordered.find(isContextSeedMessage)
  const rest = ordered.filter((message) => !isContextSeedMessage(message))
  return context ? [context, ...rest] : rest
}

export async function userCanShareStoreInvestigation(
  userId: string,
  storeId: string,
): Promise<boolean> {
  const ext = await prisma.globalExtension.findFirst({
    where: { storeId },
    select: { id: true },
  })
  if (!ext) return false

  const sub = await prisma.notificationSubscription.findUnique({
    where: {
      userId_extensionId: {
        userId,
        extensionId: ext.id,
      },
    },
    select: { id: true },
  })
  return !!sub
}

export async function createIssueInvestigationShare(params: {
  userId: string
  storeId: string
  issueId: string
  issue: WorkbenchCheckItem
  messages: UIMessage[]
  messageIds: string[]
}): Promise<{ shareToken: string }> {
  const allowed = await userCanShareStoreInvestigation(params.userId, params.storeId)
  if (!allowed) {
    throw new Error("FORBIDDEN")
  }

  const filtered = filterMessagesForShare(params.messages, params.messageIds)
  if (filtered.length === 0) {
    throw new Error("NO_MESSAGES")
  }

  const shareToken = createShareToken()
  await prisma.issueInvestigationShare.create({
    data: {
      shareToken,
      createdByUserId: params.userId,
      storeId: params.storeId,
      issueId: params.issueId,
      issueSnapshot: params.issue as unknown as Prisma.InputJsonValue,
      messages: sanitizeMessagesForPublic(filtered) as unknown as Prisma.InputJsonValue,
      expiresAt: null,
    },
  })

  return { shareToken }
}

export async function loadIssueInvestigationShare(
  shareToken: string,
): Promise<IssueInvestigationSharePayload | null> {
  if (!isValidShareToken(shareToken)) return null

  const row = await prisma.issueInvestigationShare.findUnique({
    where: { shareToken },
  })
  if (!row) return null
  if (row.expiresAt && row.expiresAt.getTime() < Date.now()) return null

  const issue = parseWorkbenchCheckItem(row.issueSnapshot)
  const messages = await parseStoredUIMessages(row.messages)
  if (!issue || !messages) return null

  const ext = await prisma.globalExtension.findFirst({
    where: { storeId: row.storeId },
    select: { name: true },
  })

  return {
    shareToken: row.shareToken,
    storeId: row.storeId,
    issueId: row.issueId,
    issue,
    extensionName: ext?.name?.trim() || null,
    messages: sanitizeMessagesForPublic(messages),
    createdAt: row.createdAt.toISOString(),
  }
}

