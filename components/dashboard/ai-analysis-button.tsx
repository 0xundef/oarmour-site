"use client"

import { Button } from "@/components/ui/button"
import { Sparkles } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { useTransition } from "react"
import Link from "next/link"

/**
 * Triggers the detection pipeline (recon/find/dedupe/report) for an extension.
 * The run is kicked off in the background (the route returns immediately with
 * status "started"); this button toasts a link to the workbench's AI-report tab,
 * which polls until the report stage completes.
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
        toast({
          title: "AI analysis started",
          description: (
            <span>
              Running in the background (~minutes). Open the{" "}
              <Link
                href={`/dashboard/subscribed/${extensionId}?tab=ai-report`}
                className="underline"
              >
                AI report
              </Link>{" "}
              to track progress and view results.
            </span>
          ),
        })
        void result
      } catch (error) {
        toast({
          variant: "destructive",
          title: "AI analysis failed",
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
      title="Run AI security analysis (recon/find/dedupe/report)"
    >
      <Sparkles className="h-4 w-4" />
      {pending ? "Analyzing…" : "AI Analysis"}
    </Button>
  )
}
