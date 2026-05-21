"use client"

import { useMemo } from "react"
import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport, type UIMessage } from "ai"
import { ArrowUpIcon, SquareIcon } from "lucide-react"
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation"
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message"
import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
} from "@/components/ai-elements/prompt-input"
import { Suggestion } from "@/components/ai-elements/suggestion"
import { Spinner } from "@/components/ui/spinner"
import { cn } from "@/lib/utils"
import { IssueContextDisplay } from "@/components/dashboard/issue-context-display"
import { buildIssueDetailContextText, toIssueChatContext } from "@/lib/issue-chat-context"
import type { WorkbenchCheckItem } from "@/lib/workbench-check-items"

const SUGGESTIONS = [
  "How can I verify whether this is a false positive?",
  "Give me a practical mitigation plan with priorities.",
  "What is the blast radius if this finding is real?",
  "Summarize the evidence we have for this issue.",
] as const

const CONTEXT_MESSAGE_PREFIX = "issue-context-"

function buildInitialContextMessage(issue: WorkbenchCheckItem): UIMessage {
  return {
    id: `${CONTEXT_MESSAGE_PREFIX}${issue.id}`,
    role: "user",
    parts: [{ type: "text", text: buildIssueDetailContextText(issue) }],
  }
}

function isContextSeedMessage(message: UIMessage): boolean {
  return message.id.startsWith(CONTEXT_MESSAGE_PREFIX)
}

function messageHasVisibleText(message: UIMessage): boolean {
  return message.parts.some((part) => part.type === "text" && (part.text ?? "").trim().length > 0)
}

function showAssistantThinking(messages: UIMessage[], isBusy: boolean): boolean {
  if (!isBusy) return false
  const last = messages[messages.length - 1]
  if (!last || last.role === "user") return true
  if (last.role === "assistant" && !messageHasVisibleText(last)) return true
  return false
}

export function IssueAiChatBox({ issue }: { issue: WorkbenchCheckItem }) {
  const issueContext = useMemo(() => toIssueChatContext(issue), [issue])

  const initialMessages = useMemo(() => [buildInitialContextMessage(issue)], [issue])

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/issues/chat",
        body: { issue: issueContext },
      }),
    [issueContext],
  )

  const { messages, sendMessage, status, error, stop } = useChat({
    id: `issue-chat-${issue.id}`,
    transport,
    messages: initialMessages,
  })

  const isBusy = status === "submitted" || status === "streaming"
  const hasAssistantReply = messages.some(
    (message) => message.role === "assistant" && messageHasVisibleText(message),
  )
  const thinking = showAssistantThinking(messages, isBusy)

  const sendPrompt = (text: string) => {
    const prompt = text.trim()
    if (!prompt || isBusy) return
    void sendMessage({ text: prompt })
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <Conversation className="min-h-0 flex-1 overflow-hidden">
        <ConversationContent className="mx-auto w-full max-w-3xl">
          {messages.map((message, index) => {
            const isContextSeed = isContextSeedMessage(message)
            const isLast = index === messages.length - 1
            const isStreaming = isBusy && isLast && message.role === "assistant"

            return (
              <Message key={message.id} from={message.role}>
                <MessageContent
                  className={cn(
                    isContextSeed &&
                      "max-w-full rounded-lg border border-dashed border-muted-foreground/30 bg-muted/40 px-4 py-3",
                  )}
                >
                  {isContextSeed ? (
                    <IssueContextDisplay issue={issue} />
                  ) : (
                    message.parts.map((part, partIndex) => {
                      if (part.type !== "text" || !part.text) return null
                      const hasLaterText = message.parts
                        .slice(partIndex + 1)
                        .some((p) => p.type === "text" && p.text)

                      if (message.role === "assistant") {
                        return (
                          <MessageResponse
                            key={`${message.id}-${partIndex}`}
                            isAnimating={isStreaming && !hasLaterText}
                          >
                            {part.text}
                          </MessageResponse>
                        )
                      }

                      return (
                        <div
                          key={`${message.id}-${partIndex}`}
                          className="whitespace-pre-wrap text-sm leading-6"
                        >
                          {part.text}
                        </div>
                      )
                    })
                  )}
                </MessageContent>
              </Message>
            )
          })}

          {thinking ? (
            <Message from="assistant">
              <MessageContent>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Spinner className="size-4 shrink-0" />
                  <span>AI is thinking…</span>
                </div>
              </MessageContent>
            </Message>
          ) : null}

          {!hasAssistantReply && !thinking ? (
            <div className="pt-1">
              <p className="mb-2 text-xs text-muted-foreground">Ask a follow-up about this finding:</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {SUGGESTIONS.map((suggestion) => (
                  <Suggestion
                    key={suggestion}
                    suggestion={suggestion}
                    disabled={isBusy}
                    onClick={sendPrompt}
                    variant="outline"
                    className="h-auto min-h-0 w-full justify-start rounded-lg px-3 py-2 text-left text-xs font-normal leading-snug whitespace-normal"
                  />
                ))}
              </div>
            </div>
          ) : null}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      {error ? (
        <p className="shrink-0 px-4 pb-2 text-xs text-destructive">Chat failed: {error.message}</p>
      ) : null}

      <div className="shrink-0 bg-background px-4 pb-3 pt-2">
        <PromptInput
          className="mx-auto max-w-3xl [&_[data-slot=input-group]]:min-h-0 [&_[data-slot=input-group]]:rounded-2xl [&_[data-slot=input-group]]:shadow-sm [&_textarea]:min-h-9 [&_textarea]:py-2"
          onSubmit={({ text }) => sendPrompt(text)}
        >
          <PromptInputBody>
            <PromptInputTextarea placeholder="Ask about this issue..." rows={1} />
          </PromptInputBody>
          <PromptInputFooter className="px-2 pb-1.5 pt-0">
            <div className="flex-1" />
            <PromptInputSubmit
              className="size-9 rounded-full bg-foreground text-background shadow-none hover:bg-foreground/90 disabled:opacity-50"
              onStop={stop}
              status={status}
            >
              {status === "submitted" ? (
                <Spinner className="size-4 text-background" />
              ) : status === "streaming" ? (
                <SquareIcon className="size-4" />
              ) : (
                <ArrowUpIcon className="size-4" />
              )}
            </PromptInputSubmit>
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  )
}
