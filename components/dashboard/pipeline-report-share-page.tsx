"use client"

import { useEffect, useState } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Spinner } from "@/components/ui/spinner"
import type { PipelineReportSharePayload } from "@/lib/pipeline-report-share"

export function PipelineReportPublicSharePage({ shareToken }: { shareToken: string }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [payload, setPayload] = useState<PipelineReportSharePayload | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError("")

    void (async () => {
      try {
        const res = await fetch(
          `/api/detection-pipeline/share/${encodeURIComponent(shareToken)}`,
          { cache: "no-store" },
        )
        if (!res.ok) {
          if (!cancelled) {
            setPayload(null)
            setError(
              res.status === 404
                ? "This share link is invalid or no longer available."
                : "Failed to load the shared AI report.",
            )
          }
          return
        }
        const json = (await res.json()) as PipelineReportSharePayload
        if (!cancelled) setPayload(json)
      } catch {
        if (!cancelled) {
          setPayload(null)
          setError("Failed to load the shared AI report.")
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [shareToken])

  const title = payload?.extensionName
    ? `${payload.extensionName} — AI security report`
    : "AI security report"

  return (
    <div className="mx-auto min-h-dvh max-w-4xl p-4 md:p-6">
      <Card className="flex min-h-[70dvh] flex-col overflow-hidden">
        <CardHeader className="shrink-0 border-b">
          <CardTitle className="text-lg">{title}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {payload?.extensionName
              ? `${payload.extensionName} · ${payload.storeId}`
              : payload?.storeId
                ? `Extension ${payload.storeId}`
                : "Read-only report"}
            {payload?.version ? ` · version ${payload.version}` : ""}
            {payload?.createdAt
              ? ` · Shared ${new Date(payload.createdAt).toLocaleString()}`
              : ""}
          </p>
        </CardHeader>
        <CardContent className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6">
          {loading ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
              <Spinner className="size-5" />
              <span>Loading report…</span>
            </div>
          ) : error ? (
            <p className="p-6 text-sm text-destructive">{error}</p>
          ) : payload?.reportMarkdown ? (
            <article className="prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {payload.reportMarkdown}
              </ReactMarkdown>
            </article>
          ) : (
            <p className="p-6 text-sm text-muted-foreground">Report unavailable.</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
