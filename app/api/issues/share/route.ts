import { NextResponse } from "next/server"
import { safeValidateUIMessages, type UIMessage } from "ai"
import {
  createIssueInvestigationShare,
  listActiveIssueInvestigationShares,
} from "@/lib/issue-investigation-share"
import { getIssueChatSessionUserId } from "@/lib/issue-chat-session"
import { parseIssueChatScope } from "@/lib/issue-investigation-chat"
import type { WorkbenchCheckItem } from "@/lib/workbench-check-items"
import { buildInvestigationShareUrl, getPublicSiteOrigin } from "@/lib/public-site-url"

export const runtime = "nodejs"

export async function GET(req: Request) {
  const userId = await getIssueChatSessionUserId()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const scope = parseIssueChatScope({
    storeId: searchParams.get("storeId"),
    issueId: searchParams.get("issueId"),
  })
  if (!scope) {
    return NextResponse.json({ error: "Missing storeId or issueId." }, { status: 400 })
  }

  const shares = await listActiveIssueInvestigationShares({
    userId,
    storeId: scope.storeId,
    issueId: scope.issueId,
  })

  const origin = getPublicSiteOrigin(req)
  return NextResponse.json({
    shares: shares.map((share) => ({
      ...share,
      shareUrl: buildInvestigationShareUrl(origin, share.shareToken),
    })),
  })
}

function parseIssueBody(raw: unknown): WorkbenchCheckItem | null {
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
  const issue = parseIssueBody(body?.issue)
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

    const shareUrl = buildInvestigationShareUrl(getPublicSiteOrigin(req), shareToken)

    return NextResponse.json({ ok: true, shareToken, shareUrl })
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
