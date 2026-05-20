import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { convertToModelMessages, streamText, type UIMessage } from "ai"
import { createOpenAI } from "@ai-sdk/openai"
import { authOptions } from "@/lib/auth-options"
import { buildIssueChatSystem, type IssueChatContext } from "@/lib/issue-chat-context"
import { getOpenAiChatboxConfig } from "@/lib/openai-chatbox-config"

export const runtime = "nodejs"

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const chatbox = getOpenAiChatboxConfig()
  if (!chatbox) {
    return NextResponse.json(
      {
        error:
          "OPENAI_CHATBOX_API_KEY is not set (GitHub secret or .env.local for local dev).",
      },
      { status: 500 },
    )
  }

  const investigationModel = createOpenAI({
    apiKey: chatbox.apiKey,
    baseURL: chatbox.baseURL,
  }).chat(chatbox.model)

  const body = (await req.json().catch(() => null)) as
    | { issue?: IssueChatContext; messages?: UIMessage[] }
    | null
  const issue = body?.issue
  const messages = body?.messages

  if (!issue || !Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: "Missing issue context or messages." }, { status: 400 })
  }

  const result = streamText({
    model: investigationModel,
    system: buildIssueChatSystem(issue),
    messages: await convertToModelMessages(messages),
    temperature: 0.2,
  })

  return result.toUIMessageStreamResponse()
}
