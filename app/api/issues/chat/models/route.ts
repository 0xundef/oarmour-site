import { NextResponse } from "next/server"
import { listInvestigationChatModels } from "@/lib/investigation-chat-model"
import { getIssueChatSessionUserId } from "@/lib/issue-chat-session"

export const runtime = "nodejs"

export async function GET() {
  const userId = await getIssueChatSessionUserId()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const config = listInvestigationChatModels()
  if (!config) {
    return NextResponse.json(
      {
        error:
          "OPENAI_CHATBOX_API_KEY is not set (GitHub secret or .env.local for local dev).",
      },
      { status: 500 },
    )
  }

  return NextResponse.json(config)
}
