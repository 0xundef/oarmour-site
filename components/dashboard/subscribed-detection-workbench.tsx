"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { IssueAiChatBox } from "@/components/dashboard/issue-ai-chat-box"
import type { AiTestingLatestPayload } from "@/lib/ai-testing-display"
import { formatFindingRunLabel } from "@/lib/format-finding-run-time"
import {
  buildWorkbenchCheckItems,
  normalizeExtensionVersion,
  versionsAligned,
  type StaticLatestPayload,
  type WorkbenchCheckItem,
  type WorkbenchCheckSeverity,
} from "@/lib/workbench-check-items"

function severityClass(level: WorkbenchCheckSeverity) {
  if (level === "CRITICAL") return "bg-red-500 text-white"
  if (level === "HIGH") return "bg-orange-500 text-white"
  if (level === "MEDIUM") return "bg-yellow-500 text-white"
  return "bg-slate-500 text-white"
}

function sourceBadgeClass(source: WorkbenchCheckItem["source"]) {
  return source === "static" ? "bg-slate-700 text-white" : "bg-purple-600 text-white"
}

function categoryBadgeClass() {
  return "border-muted-foreground/25 bg-muted/50 text-muted-foreground"
}

export function SubscribedDetectionWorkbench({
  storeId,
  extensionName,
  extensionVersion: extensionVersionHint,
}: {
  storeId: string
  extensionName: string
  extensionVersion?: string | null
}) {
  const [items, setItems] = useState<WorkbenchCheckItem[]>([])
  const [alignedVersion, setAlignedVersion] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState("")
  const [activeId, setActiveId] = useState<string>("")

  const load = useCallback(async () => {
    if (!storeId.trim()) {
      setItems([])
      setLoading(false)
      return
    }
    setLoading(true)
    setLoadError("")
    setAlignedVersion(null)
    let staticPayload: StaticLatestPayload | null = null
    let aiPayload: AiTestingLatestPayload | null = null

    try {
      const staticRes = await fetch(`/api/extensions/${encodeURIComponent(storeId)}/latest`, {
        cache: "no-store",
      })

      if (staticRes.ok) {
        staticPayload = (await staticRes.json()) as StaticLatestPayload
      }

      const staticVersion =
        (typeof staticPayload?.extensionVersion === "string" && staticPayload.extensionVersion.trim()) ||
        extensionVersionHint?.trim() ||
        ""

      if (staticVersion) {
        const aiUrl = `/api/ai-testing/${encodeURIComponent(storeId)}/latest?version=${encodeURIComponent(staticVersion)}`
        const aiRes = await fetch(aiUrl, { cache: "no-store" })
        if (aiRes.ok) {
          const candidate = (await aiRes.json()) as AiTestingLatestPayload
          if (versionsAligned(staticVersion, candidate.version ?? "")) {
            aiPayload = candidate
          }
        }
      }

      if (!staticRes.ok && !staticPayload) {
        setLoadError("No static analysis or AI testing data available yet.")
        setItems([])
        setActiveId("")
        return
      }

      const versionLabel =
        staticVersion && aiPayload ? normalizeExtensionVersion(staticVersion) : null
      setAlignedVersion(versionLabel)

      const built = buildWorkbenchCheckItems({ staticPayload, aiPayload })
      setItems(built)
      setActiveId((prev) => {
        if (prev && built.some((i) => i.id === prev)) return prev
        return built[0]?.id ?? ""
      })
    } catch {
      setLoadError("Failed to load findings.")
      setItems([])
      setActiveId("")
    } finally {
      setLoading(false)
    }
  }, [storeId, extensionVersionHint])

  useEffect(() => {
    load()
  }, [load])

  const active = useMemo(
    () => items.find((item) => item.id === activeId) ?? items[0] ?? null,
    [activeId, items],
  )

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-4 md:px-8 md:pb-8 md:pt-4">
      {loadError ? (
        <div className="mb-3 shrink-0 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
          {loadError}
        </div>
      ) : null}

      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <CardContent className="flex min-h-0 flex-1 flex-col p-0">
          <div className="grid h-[calc(100dvh-8rem)] min-h-0 grid-cols-1 lg:grid-cols-[340px_1fr]">
            <aside className="flex min-h-0 flex-col overflow-hidden border-r bg-muted/20">
              <div className="shrink-0 border-b p-3">
                <div className="text-base font-semibold leading-snug">{extensionName}</div>
                <div className="text-xs text-muted-foreground">
                  {loading
                    ? "Loading…"
                    : alignedVersion
                      ? `${items.length} finding${items.length === 1 ? "" : "s"} · version ${alignedVersion}`
                      : `${items.length} finding${items.length === 1 ? "" : "s"}`}
                </div>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-2">
                {loading ? (
                  <div className="p-3 text-sm text-muted-foreground">Loading findings…</div>
                ) : items.length === 0 ? (
                  <div className="p-3 text-sm text-muted-foreground">
                    No findings from the latest static scan or AI test match the current rules (e.g. broad permissions,
                    flagged domains, runtime failures).
                  </div>
                ) : (
                  items.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setActiveId(item.id)}
                      className={cn(
                        "mb-2 w-full rounded-md border p-3 text-left hover:bg-accent",
                        active && item.id === active.id ? "border-primary bg-accent" : "bg-background",
                      )}
                    >
                      <div className="mb-2 flex flex-wrap items-center gap-1.5">
                        <Badge className={cn("h-5 px-1.5 text-[10px] leading-none", severityClass(item.severity))}>
                          {item.severity}
                        </Badge>
                        <Badge className={cn("h-5 shrink-0 px-1.5 text-[10px] leading-none", sourceBadgeClass(item.source))}>
                          {item.source}
                        </Badge>
                        <Badge variant="outline" className={cn("h-5 px-1.5 text-[10px] font-normal leading-none", categoryBadgeClass())}>
                          {item.category}
                        </Badge>
                      </div>
                      <div className="mb-1 line-clamp-2 text-sm font-medium leading-snug">{item.title}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {formatFindingRunLabel(item.source, item.detectedAt)}
                      </div>
                      <div className="truncate text-xs text-muted-foreground/80" title={item.file}>
                        {item.file}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </aside>

            <section className="flex min-h-0 flex-col overflow-hidden">
              {!active ? (
                <div className="p-5 text-sm text-muted-foreground">Select a finding or wait for data to load.</div>
              ) : (
                <IssueAiChatBox key={active.id} storeId={storeId} issue={active} />
              )}
            </section>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
