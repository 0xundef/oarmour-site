import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth-options"
import { runDetectionPipeline } from "@/lib/detection-pipeline/orchestrator"

export const runtime = "nodejs"
// The pipeline runs N LLM `query()` calls and can take minutes. For v1 (manual admin
// trigger) we await in-process on a long-running server. Production hardening should
// move this to a background worker / ScanJob (see plan risk #1).
export const maxDuration = 300

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
    const result = await runDetectionPipeline({ storeId, version, runId, source, candidateDomains })
    return NextResponse.json({
      runDir: result.runDir,
      runId: result.runId,
      stages: Object.fromEntries(Object.entries(result.manifest.stages).map(([k, v]) => [k, v.status])),
      sourceFidelity: result.manifest.sourceFidelity,
      report: `${result.runDir}/report.md`,
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    )
  }
}
