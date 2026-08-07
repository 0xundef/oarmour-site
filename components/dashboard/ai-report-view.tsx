"use client"

import { useEffect, useRef, useState } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Loader2, RefreshCw, MessageSquareText, Share2 } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"

export type AiReportState = {
  runId: string
  startedAt: string
  finishedAt: string | null
  sourceFidelity: string
  status: "running" | "completed" | "failed"
  /** True when the run was marked failed because it stalled (killed mid-stage). */
  stale?: boolean
  markdown: string | null
}

export function AiReportView({
  aiReportState,
  storeId,
  onInvestigateInChat,
}: {
  aiReportState: AiReportState | null
  storeId: string
  onInvestigateInChat: () => void
}) {
  const { toast } = useToast()
  const [state, setState] = useState<AiReportState | null>(aiReportState)
  const [refetching, setRefetching] = useState(false)
  const [sharing, setSharing] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const handleShare = async () => {
    setSharing(true)
    try {
      const res = await fetch("/api/detection-pipeline/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeId, expiresInDays: 30 }),
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null
        throw new Error(data?.error ?? `Share failed (${res.status})`)
      }
      const data = (await res.json()) as { shareToken: string }
      const url = `${window.location.origin}/report-share/${data.shareToken}`
      await navigator.clipboard.writeText(url)
      toast({ description: "Share link copied to clipboard." })
    } catch (e) {
      toast({
        variant: "destructive",
        description: e instanceof Error ? e.message : String(e),
      })
    } finally {
      setSharing(false)
    }
  }

  const refetch = async () => {
    setRefetching(true)
    try {
      const res = await fetch(
        `/api/detection-pipeline/report?storeId=${encodeURIComponent(storeId)}`,
        { cache: "no-store" },
      )
      if (res.status === 404) {
        setState(null)
      } else if (!res.ok) {
        throw new Error(`Request failed (${res.status})`)
      } else {
        setState((await res.json()) as AiReportState)
      }
    } catch (e) {
      toast({
        variant: "destructive",
        description: e instanceof Error ? e.message : String(e),
      })
    } finally {
      setRefetching(false)
    }
  }

  // Poll while a run is in progress.
  useEffect(() => {
    if (state?.status !== "running") {
      if (pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
      return
    }
    pollRef.current = setInterval(() => {
      void refetch()
    }, 5000)
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.status])

  if (!state) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
        <p className="text-sm text-muted-foreground">
          No AI analysis report yet. Go to the{" "}
          <a href="/dashboard/extension" className="underline">
            extension list
          </a>{" "}
          and click “AI Analysis” to generate one.
        </p>
        <Button variant="outline" size="sm" onClick={refetch} disabled={refetching}>
          <RefreshCw className="h-4 w-4" />
          Recheck
        </Button>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2 text-xs text-muted-foreground">
        {state.status === "running" ? (
          <Badge className="h-5 px-1.5 text-[10px] leading-none bg-slate-500 text-white">
            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
            Analyzing
          </Badge>
        ) : state.status === "failed" ? (
          <Badge variant="destructive" className="h-5 px-1.5 text-[10px] leading-none">
            {state.stale ? "Stalled" : "Failed"}
          </Badge>
        ) : (
          <Badge variant="outline" className="h-5 px-1.5 text-[10px] leading-none">
            fidelity: {state.sourceFidelity}
          </Badge>
        )}
        <span>run: {state.runId.slice(0, 25)}</span>
        <span>·</span>
        <span>{state.startedAt ? new Date(state.startedAt).toLocaleString() : ""}</span>
        <div className="ml-auto flex items-center gap-2">
          {state.status === "completed" && state.markdown ? (
            <>
              <Button variant="outline" size="sm" onClick={handleShare} disabled={sharing}>
                <Share2 className="h-4 w-4" />
                {sharing ? "Sharing…" : "Share"}
              </Button>
              <Button variant="default" size="sm" onClick={onInvestigateInChat}>
                <MessageSquareText className="h-4 w-4" />
                Investigate in chat
              </Button>
            </>
          ) : null}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        {state.status === "running" ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            AI analysis in progress (recon → find → dedupe → report)…
          </div>
        ) : state.status === "failed" ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
            <p className="max-w-md text-sm text-destructive">
              {state.stale
                ? "The previous analysis run stalled (the server was restarted mid-run). Go to the extension list and click “AI Analysis” to start a fresh run."
                : "AI analysis failed. Please retry later or check the server logs."}
            </p>
            <Button variant="outline" size="sm" onClick={refetch} disabled={refetching}>
              <RefreshCw className="h-4 w-4" />
              Recheck
            </Button>
          </div>
        ) : state.markdown ? (
          <article className="prose prose-sm dark:prose-invert max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{state.markdown}</ReactMarkdown>
          </article>
        ) : (
          <div className="p-4 text-sm text-muted-foreground">Report unavailable.</div>
        )}
      </div>
    </div>
  )
}
