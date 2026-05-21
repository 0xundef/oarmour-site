import { NextResponse } from "next/server"
import { safeValidateUIMessages, type UIMessage } from "ai"
import {
  createIssueInvestigationShare,
  parseWorkbenchCheckItem,
} from "@/lib/issue-investigation-share"
import { getIssueChatSessionUserId } from "@/lib/issue-chat-session"
import { parseIssueChatScope } from "@/lib/issue-investigation-chat"

export const runtime = "nodejs"

export async function POST(req: Request) {
  const userId = await getIssueChatSessionUserId()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = (await req.json().catch(() => null)) as
    | {
        storeId?: string
        issueId?: string
        issue?: unknown
        messageIds?: string[]
        messages?: UIMessage[]
      }
    | null

  const scope = parseIssueChatScope({ storeId: body?.storeId, issueId: body?.issueId })
  const issue = parseWorkbenchCheckItem(body?.issue)
  const messageIds = Array.isArray(body?.messageIds)
    ? body.messageIds.filter((id): id is string => typeof id === "string" && id.trim().length > 0)
    : []
  const messagesRaw = Array.isArray(body?.messages) ? body.messages : []
  const validatedMessages = await safeValidateUIMessages({ messages: messagesRaw as UIMessage[] })

  if (!scope || !issue || messageIds.length === 0 || !validatedMessages.success) {
    return NextResponse.json(
      { error: "Missing storeId, issueId, issue snapshot, messages, or messageIds." },
      { status: 400 },
    )
  }

  if (issue.id !== scope.issueId) {
    return NextResponse.json({ error: "Issue id mismatch." }, { status: 400 })
  }

  try {
    const { shareToken } = await createIssueInvestigationShare({
      userId,
      storeId: scope.storeId,
      issueId: scope.issueId,
      issue,
      messages: validatedMessages.data,
      messageIds,
    })

    return NextResponse.json({ ok: true, shareToken })
  } catch (e) {
    const message = e instanceof Error ? e.message : ""
    if (message === "FORBIDDEN") {
      return NextResponse.json({ error: "Not allowed to share this extension." }, { status: 403 })
    }
    if (message === "NO_MESSAGES") {
      return NextResponse.json({ error: "No messages selected to share." }, { status: 400 })
    }
    return NextResponse.json({ error: "Failed to create share link." }, { status: 500 })
  }
}
