"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Sparkles } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { IssueAiChatBox } from "@/components/dashboard/issue-ai-chat-box"
import type { AiTestingLatestPayload } from "@/lib/ai-testing-display"
import { formatFindingRunLabel } from "@/lib/format-finding-run-time"
import {
  applyFindingResolutions,
  domainFromMaliciousFindingIssueId,
  getFindingListResolution,
  isFindingResolved,
  sortWorkbenchFindingList,
} from "@/lib/finding-resolution"
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

/** Literal in this file so Tailwind JIT emits `after:*` utilities (imported strings are not scanned). */
const SEVERITY_BADGE_STRIKE =
  "relative overflow-hidden after:pointer-events-none after:absolute after:inset-x-0.5 after:top-1/2 after:h-[2px] after:-translate-y-1/2 after:z-10 after:bg-black after:content-['']"

type ResolutionState = {
  dismissedIssueIds: Set<string>
  allowlistedDomains: Set<string>
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
  const [allItems, setAllItems] = useState<WorkbenchCheckItem[]>([])
  const [resolutions, setResolutions] = useState<ResolutionState>({
    dismissedIssueIds: new Set(),
    allowlistedDomains: new Set(),
  })
  const [alignedVersion, setAlignedVersion] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState("")
  const [activeId, setActiveId] = useState<string>("")

  const loadResolutions = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/extensions/${encodeURIComponent(storeId)}/findings/resolutions`,
        { cache: "no-store" },
      )
      if (!res.ok) return
      const data = (await res.json()) as {
        dismissals?: Array<{ issueId: string }>
        allowlist?: Array<{ domain: string }>
      }
      setResolutions({
        dismissedIssueIds: new Set(
          (data.dismissals ?? []).map((d) => d.issueId).filter(Boolean),
        ),
        allowlistedDomains: new Set(
          (data.allowlist ?? []).map((a) => a.domain.trim().toLowerCase()).filter(Boolean),
        ),
      })
    } catch {
      // Non-fatal; show unfiltered findings if resolutions fail to load.
    }
  }, [storeId])

  const load = useCallback(async () => {
    if (!storeId.trim()) {
      setAllItems([])
      setLoading(false)
      return
    }
    setLoading(true)
    setLoadError("")
    setAlignedVersion(null)
    let staticPayload: StaticLatestPayload | null = null
    let aiPayload: AiTestingLatestPayload | null = null

    try {
      await loadResolutions()

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
        setAllItems([])
        setActiveId("")
        return
      }

      // Version follows static analysis; AI findings merge only when aiPayload is version-aligned.
      const versionLabel = staticVersion ? normalizeExtensionVersion(staticVersion) : null
      setAlignedVersion(versionLabel)

      const built = buildWorkbenchCheckItems({ staticPayload, aiPayload })
      setAllItems(built)
    } catch {
      setLoadError("Failed to load findings.")
      setAllItems([])
      setActiveId("")
    } finally {
      setLoading(false)
    }
  }, [storeId, extensionVersionHint, loadResolutions])

  useEffect(() => {
    void load()
  }, [load])

  const activeItems = useMemo(
    () => applyFindingResolutions(allItems, resolutions),
    [allItems, resolutions],
  )

  const listItems = useMemo(
    () => sortWorkbenchFindingList(allItems, resolutions),
    [allItems, resolutions],
  )

  const openHighCriticalCount = useMemo(() => {
    return activeItems.filter((i) => i.severity === "CRITICAL" || i.severity === "HIGH").length
  }, [activeItems])

  useEffect(() => {
    setActiveId((prev) => {
      if (prev && listItems.some((i) => i.id === prev)) return prev
      return listItems[0]?.id ?? ""
    })
  }, [listItems])

  const active = useMemo(
    () => listItems.find((item) => item.id === activeId) ?? listItems[0] ?? null,
    [activeId, listItems],
  )

  const activeFindingIsOpen = useMemo(
    () => (active ? !isFindingResolved(active, resolutions) : false),
    [active, resolutions],
  )

  const activeFindingResolution = useMemo(
    () => (active ? getFindingListResolution(active, resolutions) : "active"),
    [active, resolutions],
  )

  const activeDomainOnAllowlist = useMemo(() => {
    if (!active) return false
    const domain = domainFromMaliciousFindingIssueId(active.id)
    return domain != null && resolutions.allowlistedDomains.has(domain)
  }, [active, resolutions])

  const handleResolutionChange = useCallback(() => {
    void loadResolutions().then(() => load())
  }, [loadResolutions, load])

  const headerSubtitle = useMemo(() => {
    if (loading) return "Loading…"
    const total = allItems.length
    const activeCount = activeItems.length
    const versionPart = alignedVersion ? ` · version ${alignedVersion}` : ""
    if (total === 0) return `No findings${versionPart}`
    if (activeCount === total) {
      return `${activeCount} active finding${activeCount === 1 ? "" : "s"}${versionPart}`
    }
    return `${activeCount} active · ${total} total${versionPart}`
  }, [loading, allItems.length, activeItems.length, alignedVersion])

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
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="text-base font-semibold leading-snug">{extensionName}</div>
                    {!loading && openHighCriticalCount > 0 ? (
                      <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                        {openHighCriticalCount} high+
                      </Badge>
                    ) : null}
                  </div>
                  <div className="text-xs text-muted-foreground">{headerSubtitle}</div>
                </div>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-2">
                {loading ? (
                  <div className="p-3 text-sm text-muted-foreground">Loading findings…</div>
                ) : listItems.length === 0 ? (
                  <div className="p-3 text-sm text-muted-foreground">No findings yet.</div>
                ) : (
                  listItems.map((item) => {
                    const resolution = getFindingListResolution(item, resolutions)
                    const resolved = resolution !== "active"

                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setActiveId(item.id)}
                        className={cn(
                          "mb-2 w-full rounded-md border p-3 text-left hover:bg-accent",
                          active && item.id === active.id ? "border-primary bg-accent" : "bg-background",
                          resolved && "opacity-80",
                        )}
                      >
                        <div className="mb-2 flex flex-wrap items-center gap-1.5">
                          <Badge
                            className={cn(
                              "h-5 px-1.5 text-[10px] leading-none",
                              severityClass(item.severity),
                              resolved && SEVERITY_BADGE_STRIKE,
                            )}
                          >
                            <span className={cn(resolved && "opacity-95")}>{item.severity}</span>
                          </Badge>
                          <Badge
                            className={cn(
                              "h-5 shrink-0 leading-none",
                              item.source === "ai" ? "w-5 justify-center px-0" : "px-1.5 text-[10px]",
                              sourceBadgeClass(item.source),
                            )}
                            aria-label={item.source === "ai" ? "AI test" : undefined}
                          >
                            {item.source === "ai" ? (
                              <Sparkles className="size-3" aria-hidden />
                            ) : (
                              item.source
                            )}
                          </Badge>
                          <Badge
                            variant="outline"
                            className={cn(
                              "h-5 px-1.5 text-[10px] font-normal leading-none",
                              categoryBadgeClass(),
                            )}
                          >
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
                    )
                  })
                )}
              </div>
            </aside>

            <section className="flex min-h-0 flex-col overflow-hidden">
              {!active ? (
                <div className="p-5 text-sm text-muted-foreground">Select a finding or wait for data to load.</div>
              ) : (
                <IssueAiChatBox
                  key={active.id}
                  storeId={storeId}
                  issue={active}
                  extensionVersion={alignedVersion}
                  findingIsActive={activeFindingIsOpen}
                  findingResolution={activeFindingResolution}
                  domainOnAllowlist={activeDomainOnAllowlist}
                  onResolutionChange={handleResolutionChange}
                />
              )}
            </section>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
