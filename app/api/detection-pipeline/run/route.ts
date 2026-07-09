import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth-options"
import { startDetectionPipelineBackground } from "@/lib/detection-pipeline/orchestrator"

export const runtime = "nodejs"
// The trigger returns immediately; the minutes-long pipeline runs in the background
// (floating promise in the Next.js server process). Client polls
// GET /api/detection-pipeline/report?storeId= until the report stage completes.
export const maxDuration = 30

export async function GET() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 })
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const payload = await req.json().catch(() => ({}))
  const storeId = typeof payload?.storeId === "string" && payload.storeId.trim() ? payload.storeId.trim() : undefined
  const version = typeof payload?.version === "string" && payload.version.trim() ? payload.version.trim() : undefined
  if (!storeId || !version) {
    return NextResponse.json({ error: "storeId and version are required" }, { status: 400 })
  }

  const runId = typeof payload?.runId === "string" && payload.runId.trim() ? payload.runId.trim() : undefined
  const source =
    payload?.source === "static" || payload?.source === "runtime" || payload?.source === "general"
      ? (payload.source as "static" | "runtime" | "general")
      : undefined
  const candidateDomains =
    Array.isArray(payload?.candidateDomains)
      ? (payload.candidateDomains as unknown[]).filter((d): d is string => typeof d === "string" && d.trim() !== "").map((d) => d.trim())
      : undefined

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY is not configured on the server" }, { status: 500 })
  }

  try {
    const started = startDetectionPipelineBackground({ storeId, version, runId, source, candidateDomains })
    return NextResponse.json({
      runDir: started.runDir,
      runId: started.runId,
      status: "started",
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    )
  }
}

