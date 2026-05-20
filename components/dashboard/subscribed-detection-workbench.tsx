"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import type { AiTestingLatestPayload } from "@/lib/ai-testing-display"
import {
  buildWorkbenchCheckItems,
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

export function SubscribedDetectionWorkbench({
  storeId,
  extensionName,
}: {
  storeId: string
  extensionName: string
}) {
  const [items, setItems] = useState<WorkbenchCheckItem[]>([])
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
    let staticPayload: StaticLatestPayload | null = null
    let aiPayload: AiTestingLatestPayload | null = null

    try {
      const [staticRes, aiRes] = await Promise.all([
        fetch(`/api/extensions/${encodeURIComponent(storeId)}/latest`, { cache: "no-store" }),
        fetch(`/api/ai-testing/${encodeURIComponent(storeId)}/latest`, { cache: "no-store" }),
      ])

      if (staticRes.ok) {
        staticPayload = (await staticRes.json()) as StaticLatestPayload
      }
      if (aiRes.ok) {
        aiPayload = (await aiRes.json()) as AiTestingLatestPayload
      }

      if (!staticRes.ok && !aiRes.ok) {
        setLoadError("No static analysis or AI testing data available yet.")
        setItems([])
        setActiveId("")
        return
      }

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
  }, [storeId])

  useEffect(() => {
    load()
  }, [load])

  const active = useMemo(
    () => items.find((item) => item.id === activeId) ?? items[0] ?? null,
    [activeId, items],
  )

  return (
    <div className="flex-1 p-4 md:px-8 md:pb-8 md:pt-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <div className="text-2xl font-semibold">{extensionName}</div>
        <div className="text-xs text-muted-foreground font-mono">{storeId}</div>
      </div>

      {loadError ? (
        <div className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
          {loadError}
        </div>
      ) : null}

      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div className="grid min-h-[72vh] grid-cols-1 lg:grid-cols-[340px_1fr]">
            <aside className="border-r bg-muted/20">
              <div className="border-b p-3">
                <div className="text-sm font-semibold">Check Items</div>
                <div className="text-xs text-muted-foreground">
                  {loading ? "Loading…" : `${items.length} finding${items.length === 1 ? "" : "s"}`}
                </div>
              </div>
              <div className="max-h-[72vh] overflow-y-auto p-2">
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
                      <div className="mb-1 flex items-center gap-2">
                        <span className="text-xs text-muted-foreground truncate">{item.id}</span>
                        <Badge className={cn("h-5 shrink-0 px-1.5 text-[10px] leading-none", sourceBadgeClass(item.source))}>
                          {item.source}
                        </Badge>
                      </div>
                      <div className="mb-1 line-clamp-2 text-sm font-medium">{item.title}</div>
                      <div className="text-xs text-muted-foreground">{item.file}</div>
                    </button>
                  ))
                )}
              </div>
            </aside>

            <section className="p-5 lg:p-6">
              {!active ? (
                <div className="text-sm text-muted-foreground">Select a finding or wait for data to load.</div>
              ) : (
                <>
                  <div className="mb-3 flex flex-wrap items-center gap-3">
                    <span className="text-lg font-semibold font-mono break-all">{active.id}</span>
                    <Badge className={severityClass(active.severity)}>{active.severity}</Badge>
                    <Badge className={cn("h-6 px-2 text-[11px]", sourceBadgeClass(active.source))}>{active.source}</Badge>
                  </div>
                  <h2 className="mb-4 text-2xl font-bold leading-snug md:text-3xl">{active.title}</h2>

                  <div className="mb-5">
                    <div className="mb-1 text-sm font-semibold text-muted-foreground">Summary</div>
                    <p className="text-base leading-7">{active.summary}</p>
                  </div>

                  <div className="mb-5">
                    <div className="mb-1 text-sm font-semibold text-muted-foreground">Conditions</div>
                    <ul className="list-disc space-y-1 pl-5 text-base">
                      {active.conditions.map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <div className="mb-1 text-sm font-semibold text-muted-foreground">Impact</div>
                    <p className="text-base leading-7">{active.impact}</p>
                  </div>
                </>
              )}
            </section>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
