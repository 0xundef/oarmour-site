import { NextResponse } from "next/server"
import {
  isValidShareToken,
  loadIssueInvestigationShare,
  revokeIssueInvestigationShare,
} from "@/lib/issue-investigation-share"
import { getIssueChatSessionUserId } from "@/lib/issue-chat-session"

export const runtime = "nodejs"

type RouteContext = { params: Promise<{ token: string }> }

export async function GET(_req: Request, context: RouteContext) {
  const { token } = await context.params
  const shareToken = decodeURIComponent(token ?? "").trim()

  if (!isValidShareToken(shareToken)) {
    return NextResponse.json({ error: "Invalid share link." }, { status: 400 })
  }

  const payload = await loadIssueInvestigationShare(shareToken)
  if (!payload) {
    return NextResponse.json({ error: "Share link not found or no longer available." }, { status: 404 })
  }

  return NextResponse.json(payload)
}

export async function DELETE(_req: Request, context: RouteContext) {
  const userId = await getIssueChatSessionUserId()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { token } = await context.params
  const shareToken = decodeURIComponent(token ?? "").trim()

  if (!isValidShareToken(shareToken)) {
    return NextResponse.json({ error: "Invalid share link." }, { status: 400 })
  }

  const revoked = await revokeIssueInvestigationShare({ userId, shareToken })
  if (!revoked) {
    return NextResponse.json({ error: "Share link not found." }, { status: 404 })
  }

  return NextResponse.json({ ok: true, revoked: true })
}
