"use client"

import { useEffect, useState } from "react"
import type { UIMessage } from "ai"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Spinner } from "@/components/ui/spinner"
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation"
import { IssueInvestigationTranscript } from "@/components/investigation/issue-investigation-transcript"
import type { IssueInvestigationSharePayload } from "@/lib/issue-investigation-share"
import type { WorkbenchCheckItem } from "@/lib/workbench-check-items"

export function InvestigationPublicSharePage({ shareToken }: { shareToken: string }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [payload, setPayload] = useState<IssueInvestigationSharePayload | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError("")

    void (async () => {
      try {
        const res = await fetch(`/api/issues/share/${encodeURIComponent(shareToken)}`, {
          cache: "no-store",
        })
        if (!res.ok) {
          if (!cancelled) {
            setPayload(null)
            setError(
              res.status === 404
                ? "This share link is invalid or has been revoked."
                : "Failed to load shared investigation.",
            )
          }
          return
        }
        const json = (await res.json()) as IssueInvestigationSharePayload
        if (!cancelled) {
          setPayload(json)
        }
      } catch {
        if (!cancelled) {
          setPayload(null)
          setError("Failed to load shared investigation.")
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [shareToken])

  const issue = payload?.issue as WorkbenchCheckItem | undefined
  const messages = (payload?.messages ?? []) as UIMessage[]

  return (
    <div className="mx-auto min-h-dvh max-w-4xl p-4 md:p-6">
      <Card className="flex min-h-[70dvh] flex-col overflow-hidden">
        <CardHeader className="shrink-0 border-b">
          <CardTitle className="text-lg">Shared investigation</CardTitle>
          <p className="text-sm text-muted-foreground">
            {payload?.extensionName
              ? `${payload.extensionName} · ${payload.storeId}`
              : payload?.storeId
                ? `Extension ${payload.storeId}`
                : "Read-only snapshot"}
            {payload?.createdAt
              ? ` · Shared ${new Date(payload.createdAt).toLocaleString()}`
              : ""}
          </p>
        </CardHeader>
        <CardContent className="flex min-h-0 flex-1 flex-col p-0">
          {loading ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
              <Spinner className="size-5" />
              <span>Loading investigation…</span>
            </div>
          ) : error ? (
            <p className="p-6 text-sm text-destructive">{error}</p>
          ) : issue ? (
            <Conversation className="min-h-0 flex-1">
              <ConversationContent className="mx-auto w-full max-w-3xl py-4">
                <IssueInvestigationTranscript issue={issue} messages={messages} />
              </ConversationContent>
              <ConversationScrollButton />
            </Conversation>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
