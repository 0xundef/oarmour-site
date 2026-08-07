import { NextResponse } from "next/server"
import { isValidShareToken, loadPipelineReportShare } from "@/lib/pipeline-report-share"

export const runtime = "nodejs"

type RouteContext = { params: Promise<{ token: string }> }

export async function GET(_req: Request, context: RouteContext) {
  const { token } = await context.params
  const shareToken = decodeURIComponent(token ?? "").trim()

  if (!isValidShareToken(shareToken)) {
    return NextResponse.json({ error: "Invalid share link." }, { status: 400 })
  }

  const payload = await loadPipelineReportShare(shareToken)
  if (!payload) {
    return NextResponse.json(
      { error: "Share link not found or no longer available." },
      { status: 404 },
    )
  }

  return NextResponse.json(payload)
}
