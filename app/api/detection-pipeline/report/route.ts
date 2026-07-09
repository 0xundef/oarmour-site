import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth-options"
import { getLatestPipelineRunState } from "@/lib/detection-pipeline/storage"

export const runtime = "nodejs"

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const { searchParams } = new URL(req.url)
  const storeId = searchParams.get("storeId")?.trim()
  if (!storeId) {
    return NextResponse.json({ error: "storeId is required" }, { status: 400 })
  }
  const state = getLatestPipelineRunState(storeId)
  if (!state) {
    return NextResponse.json({ error: "No pipeline report found for this store." }, { status: 404 })
  }
  return NextResponse.json(state)
}
