"use client"

import { Sparkles } from "lucide-react"
import type { DynamicAnalysisDisplayStatus } from "@/lib/dynamic-analysis-display"
import { cn } from "@/lib/utils"

const LABELS: Record<DynamicAnalysisDisplayStatus, string> = {
  in_progress: "AI test session: queued, dispatched, or running",
  success: "AI test session: complete",
  unavailable: "AI test session: error, cancelled, or no run for this version",
}

export function DynamicAnalysisSparkle({
  status,
}: {
  status: DynamicAnalysisDisplayStatus
}) {
  const label = LABELS[status]
  return (
    <span
      className="inline-flex items-center justify-center"
      title={label}
      aria-label={label}
      role="img"
    >
      <Sparkles
        className={cn(
          "h-4 w-4",
          status === "in_progress" && "animate-pulse text-amber-500",
          status === "success" && "text-emerald-500",
          status === "unavailable" && "text-muted-foreground/35",
        )}
        aria-hidden
      />
    </span>
  )
}
