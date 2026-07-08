"use client"

import { Button } from "@/components/ui/button"
import { Sparkles } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { useRouter } from "next/navigation"
import { useTransition } from "react"
import Link from "next/link"

/**
 * Triggers the detection pipeline (recon/find/dedupe/report) for an extension.
 * Mirrors the admin `runImmediateCheck` pattern. The run takes minutes
 * (route maxDuration = 300); the button shows a pending state until it completes,
 * then toasts a link to the workbench's AI-report tab.
 */
export function AiAnalysisButton({
  storeId,
  version,
  extensionId,
}: {
  storeId: string
  version: string
  extensionId: string
}) {
  const { toast } = useToast()
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const run = () => {
    startTransition(async () => {
      try {
        const res = await fetch("/api/detection-pipeline/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ storeId, version, source: "general" }),
        })
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body?.error || `Request failed (${res.status})`)
        }
        const result = await res.json()
        const stages = result?.stages as Record<string, string> | undefined
        const allDone = stages && Object.values(stages).every((s) => s === "completed")
        toast({
          title: allDone ? "AI 分析完成" : "AI 分析已运行（部分阶段未完成）",
          description: (
            <span>
              查看{" "}
              <Link
                href={`/dashboard/subscribed/${extensionId}?tab=ai-report`}
                className="underline"
              >
                AI 分析报告
              </Link>
              。
            </span>
          ),
        })
        router.refresh()
      } catch (error) {
        toast({
          variant: "destructive",
          title: "AI 分析失败",
          description: error instanceof Error ? error.message : String(error),
        })
      }
    })
  }

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={run}
      title="运行 AI 安全分析（recon/find/dedupe/report）"
    >
      <Sparkles className="h-4 w-4" />
      {pending ? "分析中…" : "AI 分析"}
    </Button>
  )
}
