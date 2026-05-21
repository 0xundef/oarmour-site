"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport, isToolUIPart, type UIMessage } from "ai"
import { ArrowUpIcon, Link2Icon, MoreHorizontal, SquareIcon, Trash2Icon } from "lucide-react"
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
import { IssueChatToolPart } from "@/components/dashboard/issue-chat-tool-part"
import {
  IssueInvestigationShareFooter,
  IssueInvestigationShareHeader,
} from "@/components/dashboard/issue-investigation-share-panel"
import { Checkbox } from "@/components/ui/checkbox"
import {
  buildInitialContextMessage,
  CONTEXT_MESSAGE_PREFIX,
  isContextSeedMessage,
  mergeLoadedMessagesWithSeed,
} from "@/lib/issue-chat-messages"
import { toIssueChatContext } from "@/lib/issue-chat-context"
import type { WorkbenchCheckItem } from "@/lib/workbench-check-items"

const SUGGESTIONS = [
  "How can I verify whether this is a false positive?",
  "Give me a practical mitigation plan with priorities.",
  "What is the blast radius if this finding is real?",
  "Summarize the evidence we have for this issue.",
] as const

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

async function persistIssueChatMessages(params: {
  storeId: string
  issueId: string
  messages: UIMessage[]
}) {
  await fetch("/api/issues/chat", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      storeId: params.storeId,
      issueId: params.issueId,
      messages: params.messages,
    }),
  })
}

async function deleteIssueChatHistory(params: { storeId: string; issueId: string }) {
  const qs = new URLSearchParams({
    storeId: params.storeId,
    issueId: params.issueId,
  })
  const res = await fetch(`/api/issues/chat?${qs.toString()}`, { method: "DELETE" })
  if (!res.ok) {
    throw new Error("Failed to clear conversation")
  }
}

function IssueAiChatBoxInner({
  storeId,
  issue,
  initialMessages,
  loadError,
}: {
  storeId: string
  issue: WorkbenchCheckItem
  initialMessages: UIMessage[]
  loadError: string
}) {
  const seedMessages = useMemo(() => [buildInitialContextMessage(issue)], [issue])
  const [clearDialogOpen, setClearDialogOpen] = useState(false)
  const [shareMode, setShareMode] = useState(false)
  const [shareSelectedIds, setShareSelectedIds] = useState<Set<string>>(new Set())
  const [clearing, setClearing] = useState(false)
  const [clearActionError, setClearActionError] = useState("")

  const issueContext = useMemo(() => toIssueChatContext(issue), [issue])

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/issues/chat",
        body: { issue: issueContext, storeId },
      }),
    [issueContext, storeId],
  )

  const saveMessages = useCallback(
    (messages: UIMessage[]) => {
      void persistIssueChatMessages({ storeId, issueId: issue.id, messages }).catch(() => {
        // Server also persists on stream finish; ignore transient client save errors.
      })
    },
    [storeId, issue.id],
  )

  const { messages, sendMessage, status, error, stop, setMessages, clearError: resetChatError } =
    useChat({
    id: `issue-chat-${storeId}-${issue.id}`,
    transport,
    messages: initialMessages,
      onFinish: ({ messages: nextMessages }) => {
        saveMessages(nextMessages)
      },
    })

  const shareableIds = useMemo(() => messages.map((m) => m.id), [messages])
  const optionalShareIds = useMemo(
    () => shareableIds.filter((id) => !id.startsWith(CONTEXT_MESSAGE_PREFIX)),
    [shareableIds],
  )

  const isBusy = status === "submitted" || status === "streaming"
  const hasAssistantReply = messages.some(
    (message) => message.role === "assistant" && messageHasVisibleText(message),
  )
  const hasClearableHistory = messages.some((message) => !isContextSeedMessage(message))
  const thinking = showAssistantThinking(messages, isBusy)

  const handleClearConversation = async () => {
    setClearActionError("")
    setClearing(true)
    try {
      if (isBusy) stop()
      await deleteIssueChatHistory({ storeId, issueId: issue.id })
      setMessages(seedMessages)
      resetChatError()
      setClearDialogOpen(false)
    } catch {
      setClearActionError("Could not clear conversation. Try again.")
    } finally {
      setClearing(false)
    }
  }

  const sendPrompt = (text: string) => {
    const prompt = text.trim()
    if (!prompt || isBusy || shareMode) return
    void sendMessage({ text: prompt })
  }

  const enterShareMode = () => {
    setShareSelectedIds(new Set(shareableIds))
    setShareMode(true)
  }

  const exitShareMode = () => {
    setShareMode(false)
    setShareSelectedIds(new Set())
  }

  const toggleShareMessage = (message: UIMessage, checked: boolean) => {
    if (isContextSeedMessage(message)) return
    setShareSelectedIds((prev) => {
      const next = new Set(prev)
      if (checked) next.add(message.id)
      else next.delete(message.id)
      return next
    })
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      {!shareMode ? (
        <div className="flex shrink-0 items-center justify-end border-b px-3 py-1.5">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8 text-muted-foreground"
                aria-label="Conversation actions"
              >
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem
                className="gap-2 text-xs"
                disabled={isBusy || messages.length === 0}
                onClick={enterShareMode}
              >
                <Link2Icon className="size-3.5" />
                Share
              </DropdownMenuItem>
              {hasClearableHistory ? (
                <DropdownMenuItem
                  className="gap-2 text-xs text-destructive focus:text-destructive"
                  disabled={isBusy || clearing}
                  onClick={() => setClearDialogOpen(true)}
                >
                  <Trash2Icon className="size-3.5" />
                  Clear conversation
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ) : (
        <IssueInvestigationShareHeader onCancel={exitShareMode} />
      )}

      <ConfirmDeleteDialog
        open={clearDialogOpen}
        onOpenChange={setClearDialogOpen}
        onConfirm={() => void handleClearConversation()}
        title="Clear conversation?"
        description="This removes all messages for this finding from your saved investigation history. The finding context will remain so you can start over."
        confirmLabel="Clear"
        loading={clearing}
      />

      <Conversation className="min-h-0 flex-1 overflow-hidden">
        <ConversationContent className="mx-auto w-full max-w-3xl">
          {messages.map((message, index) => {
            const isContextSeed = isContextSeedMessage(message)
            const isLast = index === messages.length - 1
            const isStreaming = isBusy && isLast && message.role === "assistant"

            const shareChecked = shareSelectedIds.has(message.id)
            const shareLocked = isContextSeedMessage(message)

            return (
              <div
                key={message.id}
                className={cn(
                  "flex gap-2",
                  shareMode && "rounded-lg",
                  shareMode && shareChecked && "bg-primary/5 ring-1 ring-primary/15",
                )}
              >
                {shareMode ? (
                  <Checkbox
                    className="mt-4 shrink-0"
                    checked={shareChecked}
                    disabled={shareLocked || isBusy}
                    onCheckedChange={(value) => toggleShareMessage(message, value === true)}
                    aria-label={shareLocked ? "Finding context (always included)" : "Include in share"}
                  />
                ) : null}
                <Message from={message.role} className="min-w-0 flex-1">
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
                      if (isToolUIPart(part)) {
                        return (
                          <IssueChatToolPart
                            key={`${message.id}-tool-${partIndex}`}
                            part={part}
                          />
                        )
                      }
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
              </div>
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

          {!shareMode && !hasAssistantReply && !thinking ? (
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

      {loadError ? (
        <p className="shrink-0 px-4 pb-1 text-xs text-amber-600 dark:text-amber-400">{loadError}</p>
      ) : null}

      {clearActionError ? (
        <p className="shrink-0 px-4 pb-1 text-xs text-destructive">{clearActionError}</p>
      ) : null}

      {error ? (
        <p className="shrink-0 px-4 pb-2 text-xs text-destructive">Chat failed: {error.message}</p>
      ) : null}

      {shareMode ? (
        <IssueInvestigationShareFooter
          storeId={storeId}
          issue={issue}
          messages={messages}
          shareableIds={shareableIds}
          optionalIds={optionalShareIds}
          selectedIds={shareSelectedIds}
          onSelectedIdsChange={setShareSelectedIds}
          onDone={exitShareMode}
          disabled={isBusy}
        />
      ) : (
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
      )}
    </div>
  )
}

export function IssueAiChatBox({
  storeId,
  issue,
}: {
  storeId: string
  issue: WorkbenchCheckItem
}) {
  const seedMessages = useMemo(() => [buildInitialContextMessage(issue)], [issue])
  const [hydratedMessages, setHydratedMessages] = useState<UIMessage[] | null>(null)
  const [loadError, setLoadError] = useState("")

  useEffect(() => {
    let cancelled = false
    setHydratedMessages(null)
    setLoadError("")

    const params = new URLSearchParams({
      storeId,
      issueId: issue.id,
    })

    void (async () => {
      try {
        const res = await fetch(`/api/issues/chat?${params.toString()}`, { cache: "no-store" })
        if (cancelled) return

        if (res.status === 404) {
          setHydratedMessages(seedMessages)
          return
        }

        if (!res.ok) {
          setLoadError("Could not load saved conversation.")
          setHydratedMessages(seedMessages)
          return
        }

        const data = (await res.json()) as { messages?: UIMessage[] | null }
        const stored = Array.isArray(data.messages) ? data.messages : []
        setHydratedMessages(mergeLoadedMessagesWithSeed(stored, issue))
      } catch {
        if (!cancelled) {
          setLoadError("Could not load saved conversation.")
          setHydratedMessages(seedMessages)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [storeId, issue, seedMessages])

  if (hydratedMessages === null) {
    return (
      <div className="flex h-full min-h-0 flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
        <Spinner className="size-5" />
        <span>Loading conversation…</span>
      </div>
    )
  }

  return (
    <IssueAiChatBoxInner
      key={`${storeId}-${issue.id}`}
      storeId={storeId}
      issue={issue}
      initialMessages={hydratedMessages}
      loadError={loadError}
    />
  )
}
