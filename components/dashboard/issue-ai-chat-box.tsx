"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport, isToolUIPart, type UIMessage } from "ai"
import {
  ArrowUpIcon,
  Link2Icon,
  ListMinus,
  MoreHorizontal,
  ShieldOffIcon,
  SquareIcon,
  Trash2Icon,
  Undo2Icon,
} from "lucide-react"
import { FindingDismissDialog } from "@/components/dashboard/finding-dismiss-dialog"
import { IssueInvestigationResolutionActions } from "@/components/dashboard/issue-investigation-resolution-actions"
import {
  domainFromMaliciousFindingIssueId,
  type FindingListResolution,
} from "@/lib/finding-resolution"
import { getInlineResolutionActionsMessageId } from "@/lib/issue-investigation-resolution-ui"
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
import { useToast } from "@/components/ui/use-toast"
import { cn } from "@/lib/utils"
import { IssueContextDisplay } from "@/components/dashboard/issue-context-display"
import {
  IssueChatToolPart,
  type IssueChatToolPartActions,
} from "@/components/dashboard/issue-chat-tool-part"
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

const CHAT_MODEL_STORAGE_KEY = "oarmour-issue-chat-model"

function pickInitialChatModel(available: string[], defaultModel: string) {
  if (typeof window === "undefined") return defaultModel
  const saved = localStorage.getItem(CHAT_MODEL_STORAGE_KEY)?.trim()
  if (saved && available.includes(saved)) return saved
  return defaultModel
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
  extensionVersion,
  findingIsActive,
  findingResolution,
  domainOnAllowlist,
  onResolutionChange,
  chatModels,
  defaultChatModel,
}: {
  storeId: string
  issue: WorkbenchCheckItem
  initialMessages: UIMessage[]
  loadError: string
  extensionVersion?: string | null
  findingIsActive: boolean
  findingResolution: FindingListResolution
  domainOnAllowlist: boolean
  onResolutionChange: () => void
  chatModels: string[]
  defaultChatModel: string
}) {
  const { toast } = useToast()
  const seedMessages = useMemo(() => [buildInitialContextMessage(issue)], [issue])
  const [clearDialogOpen, setClearDialogOpen] = useState(false)
  const [dismissDialogOpen, setDismissDialogOpen] = useState(false)
  const [revokeBusy, setRevokeBusy] = useState(false)
  const [dismissedInlineMessageId, setDismissedInlineMessageId] = useState<string | null>(null)
  const allowlistDomain = useMemo(() => domainFromMaliciousFindingIssueId(issue.id), [issue.id])
  const [shareMode, setShareMode] = useState(false)
  const [shareSelectedIds, setShareSelectedIds] = useState<Set<string>>(new Set())
  const [clearing, setClearing] = useState(false)
  const [clearActionError, setClearActionError] = useState("")
  const [selectedModel, setSelectedModel] = useState(() =>
    pickInitialChatModel(chatModels, defaultChatModel),
  )

  useEffect(() => {
    setSelectedModel((prev) => {
      if (chatModels.includes(prev)) return prev
      return defaultChatModel
    })
  }, [chatModels, defaultChatModel])

  const issueContext = useMemo(() => toIssueChatContext(issue), [issue])

  const toolPartActions = useMemo<IssueChatToolPartActions>(
    () => ({
      storeId,
      issueId: issue.id,
      extensionVersion,
      findingIsActive,
      onResolutionChange,
    }),
    [storeId, issue.id, extensionVersion, findingIsActive, onResolutionChange],
  )

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/issues/chat",
        body: { issue: issueContext, storeId, model: selectedModel },
      }),
    [issueContext, storeId, selectedModel],
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

  const inlineActionsMessageId = useMemo(
    () =>
      getInlineResolutionActionsMessageId({
        messages,
        findingIsActive,
        isBusy,
        shareMode,
        dismissedMessageId: dismissedInlineMessageId,
      }),
    [messages, findingIsActive, isBusy, shareMode, dismissedInlineMessageId],
  )

  const handleRevokeDismiss = async () => {
    setRevokeBusy(true)
    try {
      const qs = new URLSearchParams({ issueId: issue.id })
      const res = await fetch(
        `/api/extensions/${encodeURIComponent(storeId)}/findings/dismiss?${qs.toString()}`,
        { method: "DELETE" },
      )
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null
        throw new Error(data?.error || "Could not revoke dismiss.")
      }
      toast({ description: "Dismissal removed; finding is open again." })
      onResolutionChange()
    } catch (e) {
      toast({
        variant: "destructive",
        description: e instanceof Error ? e.message : "Could not revoke dismiss.",
      })
    } finally {
      setRevokeBusy(false)
    }
  }

  const handleRemoveFromAllowlist = async () => {
    if (!allowlistDomain) return
    setRevokeBusy(true)
    try {
      const qs = new URLSearchParams({ domain: allowlistDomain })
      const res = await fetch(
        `/api/extensions/${encodeURIComponent(storeId)}/allowlist?${qs.toString()}`,
        { method: "DELETE" },
      )
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null
        throw new Error(data?.error || "Could not remove from allowlist.")
      }
      toast({ description: `${allowlistDomain} removed from allowlist.` })
      onResolutionChange()
    } catch (e) {
      toast({
        variant: "destructive",
        description: e instanceof Error ? e.message : "Could not remove from allowlist.",
      })
    } finally {
      setRevokeBusy(false)
    }
  }

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
    <div className="relative flex h-full min-h-0 flex-col overflow-hidden">
      {shareMode ? (
        <IssueInvestigationShareHeader onCancel={exitShareMode} />
      ) : (
        <>
          <div className="absolute right-2 top-2 z-10">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8 bg-background/80 text-muted-foreground shadow-sm backdrop-blur-sm hover:bg-background"
                  aria-label="Conversation actions"
                >
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {findingIsActive ? (
                  <DropdownMenuItem
                    className="gap-2 text-xs"
                    disabled={isBusy}
                    onClick={() => setDismissDialogOpen(true)}
                  >
                    <ShieldOffIcon className="size-3.5" />
                    Mark false positive
                  </DropdownMenuItem>
                ) : null}
                {findingResolution === "dismissed" ? (
                  <DropdownMenuItem
                    className="gap-2 text-xs"
                    disabled={isBusy || revokeBusy}
                    onClick={() => void handleRevokeDismiss()}
                  >
                    <Undo2Icon className="size-3.5" />
                    Revoke dismiss
                  </DropdownMenuItem>
                ) : null}
                {domainOnAllowlist && allowlistDomain ? (
                  <DropdownMenuItem
                    className="gap-2 text-xs"
                    disabled={isBusy || revokeBusy}
                    onClick={() => void handleRemoveFromAllowlist()}
                  >
                    <ListMinus className="size-3.5" />
                    Remove {allowlistDomain} from allowlist
                  </DropdownMenuItem>
                ) : null}
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
          {findingIsActive ? (
            <FindingDismissDialog
              open={dismissDialogOpen}
              onOpenChange={setDismissDialogOpen}
              storeId={storeId}
              issue={issue}
              extensionVersion={extensionVersion}
              allowlistDomain={allowlistDomain}
              onDismissed={onResolutionChange}
            />
          ) : null}
        </>
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
        <ConversationContent
          className={cn("mx-auto w-full max-w-3xl", !shareMode && "pr-11")}
        >
          {messages.map((message, index) => {
            const isContextSeed = isContextSeedMessage(message)
            const isLast = index === messages.length - 1
            const isStreaming = isBusy && isLast && message.role === "assistant"
            const showActionsOnMessage =
              !shareMode && message.id === inlineActionsMessageId && message.role === "assistant"

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
                            actions={toolPartActions}
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
                  {showActionsOnMessage ? (
                    <div className="mt-3 border-t border-dashed border-muted-foreground/25 pt-3">
                      <IssueInvestigationResolutionActions
                        storeId={storeId}
                        issue={issue}
                        extensionVersion={extensionVersion}
                        allowlistDomain={allowlistDomain}
                        disabled={isBusy}
                        onResolutionChange={onResolutionChange}
                        onOpenDismissDialog={() => setDismissDialogOpen(true)}
                        onCancel={() => setDismissedInlineMessageId(message.id)}
                      />
                    </div>
                  ) : null}
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
            <PromptInputFooter className="flex-wrap gap-2 px-2 pb-1.5 pt-0">
              {chatModels.length > 1 ? (
                <div className="flex items-center gap-1.5">
                  <label
                    htmlFor="issue-chat-model"
                    className="sr-only"
                  >
                    Model
                  </label>
                  <select
                    id="issue-chat-model"
                    className="h-8 max-w-[11rem] truncate rounded-md border border-input bg-background px-2 text-xs shadow-sm"
                    value={selectedModel}
                    disabled={isBusy}
                    onChange={(e) => {
                      const next = e.target.value
                      setSelectedModel(next)
                      try {
                        localStorage.setItem(CHAT_MODEL_STORAGE_KEY, next)
                      } catch {
                        // ignore quota / private mode
                      }
                    }}
                    title="Investigation chat model"
                  >
                    {chatModels.map((id) => (
                      <option key={id} value={id}>
                        {id}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
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
  extensionVersion,
  findingIsActive = true,
  findingResolution = "active",
  domainOnAllowlist = false,
  onResolutionChange,
}: {
  storeId: string
  issue: WorkbenchCheckItem
  extensionVersion?: string | null
  findingIsActive?: boolean
  findingResolution?: FindingListResolution
  domainOnAllowlist?: boolean
  onResolutionChange?: () => void
}) {
  const seedMessages = useMemo(() => [buildInitialContextMessage(issue)], [issue])
  const [hydratedMessages, setHydratedMessages] = useState<UIMessage[] | null>(null)
  const [loadError, setLoadError] = useState("")
  const [chatModels, setChatModels] = useState<string[]>([])
  const [defaultChatModel, setDefaultChatModel] = useState("deepseek-chat")

  useEffect(() => {
    let cancelled = false
    void fetch("/api/issues/chat/models", { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok || cancelled) return
        const data = (await res.json()) as { models?: string[]; defaultModel?: string }
        const models = Array.isArray(data.models) ? data.models.filter(Boolean) : []
        if (models.length === 0) return
        setChatModels(models)
        if (typeof data.defaultModel === "string" && data.defaultModel.trim()) {
          setDefaultChatModel(data.defaultModel.trim())
        } else {
          setDefaultChatModel(models[0]!)
        }
      })
      .catch(() => {
        // Non-fatal; server default applies when model is omitted from transport.
      })

    return () => {
      cancelled = true
    }
  }, [])

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
      extensionVersion={extensionVersion}
      findingIsActive={findingIsActive}
      findingResolution={findingResolution}
      domainOnAllowlist={domainOnAllowlist}
      onResolutionChange={onResolutionChange ?? (() => {})}
      chatModels={chatModels.length > 0 ? chatModels : [defaultChatModel]}
      defaultChatModel={defaultChatModel}
    />
  )
}
