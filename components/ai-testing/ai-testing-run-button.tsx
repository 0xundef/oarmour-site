"use client"

import { useState } from "react"
import { Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/use-toast"
import {
  resolveAiTestingSparkleOutcome,
  type AiTestingStatusEntry,
} from "@/lib/ai-testing-status-client"

export function AiTestingRunButton({
  storeId,
  extensionName,
  version,
  statusEntry,
  onTriggered,
  disabled: disabledProp,
}: {
  storeId: string
  extensionName: string
  version: string | null
  statusEntry?: AiTestingStatusEntry
  onTriggered?: (storeId: string) => void
  disabled?: boolean
}) {
  const { toast } = useToast()
  const [pending, setPending] = useState(false)
  const versionUnavailable = !version || version === "N/A"

  const handleClick = async () => {
    if (pending || versionUnavailable || disabledProp) return
    setPending(true)
    try {
      const res = await fetch("/api/ai-testing/enqueue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeId, name: extensionName, version }),
      })
      const data = await res.json().catch(() => ({}))
      if (data?.queued) {
        onTriggered?.(storeId)
        toast({ description: data.message ?? "AI testing enqueued." })
        return
      }
      toast({
        description: data?.message ?? data?.error ?? "Failed to enqueue AI test",
        variant: "destructive",
      })
    } catch {
      toast({ description: "Failed to enqueue AI test", variant: "destructive" })
    } finally {
      setPending(false)
    }
  }

  const outcome = resolveAiTestingSparkleOutcome(statusEntry, pending)
  const sparkleClass =
    outcome === "failed"
      ? "text-red-500"
      : outcome === "success" || outcome === "active"
        ? "text-green-400"
        : "text-green-400"
  const animated = outcome === "active"

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => void handleClick()}
      disabled={pending || versionUnavailable || disabledProp}
      title={
        versionUnavailable
          ? "Version unavailable"
          : outcome === "failed"
            ? statusEntry?.analysisError ?? "AI testing failed"
            : animated
              ? "AI testing in progress"
              : outcome === "success"
                ? "AI testing completed"
                : "Run AI testing"
      }
      aria-label="Run AI testing"
    >
      <Sparkles className={`mr-1.5 h-3.5 w-3.5 ${sparkleClass} ${animated ? "animate-sparkle" : ""}`} />
      AI Test
    </Button>
  )
}
