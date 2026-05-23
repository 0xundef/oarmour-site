import { NextResponse } from "next/server"
import { convertToModelMessages, stepCountIs, streamText, type UIMessage } from "ai"
import { createIssueChatTools } from "@/lib/issue-chat-tools"
import { buildIssueChatSystem, type IssueChatContext } from "@/lib/issue-chat-context"
import {
  getInvestigationLanguageModel,
  resolveInvestigationProviderOptions,
} from "@/lib/investigation-chat-model"
import { getIssueChatSessionUserId } from "@/lib/issue-chat-session"
import {
  deleteIssueInvestigationChat,
  loadIssueInvestigationMessages,
  parseIssueChatScope,
  saveIssueInvestigationMessages,
} from "@/lib/issue-investigation-chat"
import { logError } from "@/lib/app-logger"

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

  const messages = await loadIssueInvestigationMessages({
    userId,
    storeId: scope.storeId,
    issueId: scope.issueId,
  })

  if (!messages) {
    return NextResponse.json({ messages: null }, { status: 404 })
  }

  return NextResponse.json({ messages })
}

export async function DELETE(req: Request) {
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

  const deleted = await deleteIssueInvestigationChat({
    userId,
    storeId: scope.storeId,
    issueId: scope.issueId,
  })

  return NextResponse.json({ ok: true, deleted })
}

export async function PUT(req: Request) {
  const userId = await getIssueChatSessionUserId()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = (await req.json().catch(() => null)) as
    | { storeId?: string; issueId?: string; messages?: UIMessage[] }
    | null
  const scope = parseIssueChatScope({ storeId: body?.storeId, issueId: body?.issueId })
  if (!scope || !Array.isArray(body?.messages)) {
    return NextResponse.json({ error: "Missing storeId, issueId, or messages." }, { status: 400 })
  }

  try {
    await saveIssueInvestigationMessages({
      userId,
      storeId: scope.storeId,
      issueId: scope.issueId,
      messages: body.messages,
    })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: "Invalid messages payload." }, { status: 400 })
  }
}

export async function POST(req: Request) {
  const userId = await getIssueChatSessionUserId()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const investigation = getInvestigationLanguageModel()
  if (!investigation) {
    return NextResponse.json(
      {
        error:
          "OPENAI_CHATBOX_API_KEY is not set (GitHub secret or .env.local for local dev).",
      },
      { status: 500 },
    )
  }

  const body = (await req.json().catch(() => null)) as
    | { issue?: IssueChatContext; storeId?: string; messages?: UIMessage[] }
    | null
  const issue = body?.issue
  const messages = body?.messages
  const scope = parseIssueChatScope({ storeId: body?.storeId, issueId: issue?.id })

  if (!issue || !scope || !Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json(
      { error: "Missing issue context, storeId, or messages." },
      { status: 400 },
    )
  }

  const tools = createIssueChatTools({ storeId: scope.storeId, findingFile: issue.file })
  const providerOptions = resolveInvestigationProviderOptions(investigation.modelId)
  const thinkingDisabled = providerOptions.deepseek.thinking?.type === "disabled"

  const result = streamText({
    model: investigation.model,
    system: buildIssueChatSystem(issue),
    messages: await convertToModelMessages(messages, { tools }),
    tools,
    stopWhen: stepCountIs(10),
    ...(thinkingDisabled ? { temperature: 0.2 } : {}),
    providerOptions,
  })

  return result.toUIMessageStreamResponse({
    originalMessages: messages,
    onFinish: async ({ messages: updatedMessages }) => {
      try {
        await saveIssueInvestigationMessages({
          userId,
          storeId: scope.storeId,
          issueId: scope.issueId,
          messages: updatedMessages,
        })
      } catch (e) {
        logError("[issues/chat] failed to persist messages", { error: e })
      }
    },
  })
}
