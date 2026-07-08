"use client"

import { useState } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { RefreshCw, MessageSquareText } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"

export type AiReport = {
  runId: string
  startedAt: string
  finishedAt: string | null
  sourceFidelity: string
  markdown: string
}

export function AiReportView({
  aiReport,
  storeId,
  onInvestigateInChat,
}: {
  aiReport: AiReport | null
  storeId: string
  onInvestigateInChat: () => void
}) {
  const { toast } = useToast()
  const [report, setReport] = useState<AiReport | null>(aiReport)
  const [refetching, setRefetching] = useState(false)

  const refetch = async () => {
    setRefetching(true)
    try {
      const res = await fetch(
        `/api/detection-pipeline/report?storeId=${encodeURIComponent(storeId)}`,
        { cache: "no-store" },
      )
      if (!res.ok) {
        if (res.status === 404) {
          setReport(null)
          toast({ description: "尚无 AI 分析报告。" })
        } else {
          throw new Error(`Request failed (${res.status})`)
        }
      } else {
        setReport((await res.json()) as AiReport)
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

  if (!report) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
        <p className="text-sm text-muted-foreground">
          尚无 AI 分析报告。前往{" "}
          <a href="/dashboard/extension" className="underline">
            扩展列表
          </a>{" "}
          点击「AI 分析」生成。
        </p>
        <Button variant="outline" size="sm" onClick={refetch} disabled={refetching}>
          <RefreshCw className="h-4 w-4" />
          重新检查
        </Button>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2 text-xs text-muted-foreground">
        <Badge variant="outline" className="text-[10px]">
          fidelity: {report.sourceFidelity}
        </Badge>
        <span>run: {report.runId.slice(0, 25)}</span>
        <span>·</span>
        <span>{report.startedAt ? new Date(report.startedAt).toLocaleString() : ""}</span>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={refetch} disabled={refetching}>
            <RefreshCw className="h-4 w-4" />
            刷新
          </Button>
          <Button variant="default" size="sm" onClick={onInvestigateInChat}>
            <MessageSquareText className="h-4 w-4" />
            在 chat 里深入调查
          </Button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        <article className="prose prose-sm dark:prose-invert max-w-none">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{report.markdown}</ReactMarkdown>
        </article>
      </div>
    </div>
  )
}
