import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth-options"
import { createPipelineReportShare } from "@/lib/pipeline-report-share"

export const runtime = "nodejs"

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = (await req.json().catch(() => null)) as {
    storeId?: string
    expiresInDays?: number
  } | null

  const storeId = body?.storeId?.trim()
  if (!storeId) {
    return NextResponse.json({ error: "storeId is required" }, { status: 400 })
  }

  const expiresInDays =
    typeof body?.expiresInDays === "number" &&
    Number.isFinite(body.expiresInDays) &&
    body.expiresInDays > 0 &&
    body.expiresInDays <= 90
      ? Math.floor(body.expiresInDays)
      : undefined

  try {
    const result = await createPipelineReportShare({
      userId: session.user.id,
      storeId,
      expiresInDays,
    })
    if (!result) {
      return NextResponse.json(
        { error: "No completed AI report available to share for this extension." },
        { status: 409 },
      )
    }
    return NextResponse.json({ ok: true, ...result })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
