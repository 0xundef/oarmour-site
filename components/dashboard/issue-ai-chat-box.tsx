"use client"

import { useMemo } from "react"
import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport, type UIMessage } from "ai"
import { ArrowUpIcon, SparklesIcon, SquareIcon } from "lucide-react"
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
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
import { Spinner } from "@/components/ui/spinner"
import { cn } from "@/lib/utils"
import { toIssueChatContext } from "@/lib/issue-chat-context"
import type { WorkbenchCheckItem } from "@/lib/workbench-check-items"

const SUGGESTIONS = [
  "How can I verify whether this is a false positive?",
  "Give me a practical mitigation plan with priorities.",
  "What is the blast radius if this finding is real?",
  "Summarize the evidence we have for this issue.",
] as const

function getMessageText(message: UIMessage): string {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("")
}

export function IssueAiChatBox({ issue }: { issue: WorkbenchCheckItem }) {
  const issueContext = useMemo(() => toIssueChatContext(issue), [issue])

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
  })

  const isBusy = status === "submitted" || status === "streaming"

  const sendPrompt = (text: string) => {
    const prompt = text.trim()
    if (!prompt || isBusy) return
    void sendMessage({ text: prompt })
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="shrink-0 border-b px-4 py-2">
        <div className="text-xs text-muted-foreground">
          {issue.id} · {issue.severity} · {issue.source}
        </div>
      </div>

      <Conversation className="min-h-0 flex-1 overflow-hidden">
        <ConversationContent
          className={cn("mx-auto w-full max-w-3xl", messages.length === 0 && "justify-center")}
        >
          {messages.length === 0 ? (
            <div className="flex w-full flex-col items-center gap-8 py-6">
              <ConversationEmptyState
                className="p-0"
                description="Ask about false positives, blast radius, exploitability, or mitigation for this finding."
                icon={<SparklesIcon className="size-8" />}
                title="What can I help investigate?"
              />
              <div className="grid w-full gap-3 sm:grid-cols-2">
                {SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    disabled={isBusy}
                    onClick={() => sendPrompt(suggestion)}
                    className="rounded-xl border bg-background p-4 text-left text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((message, index) => {
              const text = getMessageText(message)
              if (!text && message.role === "assistant") return null

              const isLast = index === messages.length - 1
              const isStreaming =
                isBusy && isLast && message.role === "assistant"

              return (
                <Message key={message.id} from={message.role}>
                  <MessageContent>
                    {message.role === "assistant" ? (
                      <MessageResponse isAnimating={isStreaming}>{text}</MessageResponse>
                    ) : (
                      text
                    )}
                  </MessageContent>
                </Message>
              )
            })
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      {error ? (
        <p className="shrink-0 px-4 pb-2 text-xs text-destructive">Chat failed: {error.message}</p>
      ) : null}

      <div className="shrink-0 bg-background p-4 pt-2">
        <PromptInput
          className="mx-auto max-w-3xl [&_[data-slot=input-group]]:rounded-2xl [&_[data-slot=input-group]]:shadow-sm"
          onSubmit={({ text }) => sendPrompt(text)}
        >
          <PromptInputBody>
            <PromptInputTextarea placeholder="Ask about this issue..." rows={3} />
          </PromptInputBody>
          <PromptInputFooter className="px-2 pb-2">
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
