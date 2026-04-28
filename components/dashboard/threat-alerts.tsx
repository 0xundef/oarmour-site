"use client"

import { Card, CardContent } from "@/components/ui/card"
import { DataTable } from "@/components/ui/data-table"
import { ColumnDef } from "@tanstack/react-table"
import { Button } from "@/components/ui/button"
import { Copy, Bell, Download } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { Badge } from "@/components/ui/badge"
import { useEffect, useState, useRef } from "react"
import { getExtensions } from "@/app/actions/get-extensions"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import Link from "next/link"

type ThreatAlert = {
  id: string
  extensionName: string
  extensionId: string
  version: string
  testingMode: boolean
  lastUpdate: string
  risk: string
  analysisStatus: string
}

type LiveAnalyzeStatus = {
  stage: string
  progress: number
}

function isAbortError(e: unknown): boolean {
  if (!e || typeof e !== "object") return false
  if (!("name" in e)) return false
  const name = (e as { name?: unknown }).name
  return name === "AbortError"
}

function getAgeDaysFromCreateTime(createTime: string | null | undefined): number | null {
  if (!createTime) return null
  const created = new Date(createTime)
  if (isNaN(created.getTime())) return null
  return Math.max(0, Math.floor((Date.now() - created.getTime()) / 86400000))
}

const OperationCell = ({ extensionId }: { extensionId: string }) => {
  const { toast } = useToast()
  const [subscribed, setSubscribed] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(extensionId)
      toast({ description: "Extension ID copied to clipboard" })
    } catch {
      toast({
        variant: "destructive",
        description: "Copy failed. Please allow clipboard access.",
      })
    }
  }

  const handleSubscribe = async () => {
    try {
      const res = await fetch('/api/notifications/subscribe', {
        method: subscribed ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ extensionId }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast({ description: data.error || 'Failed to update subscription', variant: 'destructive' })
        return
      }
      if (data.degraded) {
        toast({
          description: 'Notification subscription unavailable (degraded mode).',
          variant: 'destructive',
        })
        return
      }
      if (typeof data.subscribed === 'boolean') {
        setSubscribed(data.subscribed)
        toast({ description: data.subscribed ? 'Subscribed to alert events' : 'Unsubscribed from alerts' })
        return
      }
      if (typeof data.unsubscribed === 'boolean') {
        setSubscribed(!data.unsubscribed)
        toast({ description: data.unsubscribed ? 'Unsubscribed from alerts' : 'Subscribed to alert events' })
        return
      }
      toast({ description: 'Failed to update subscription', variant: 'destructive' })
    } catch {
      toast({ description: 'Failed to update subscription', variant: 'destructive' })
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant="ghost" size="icon" onClick={handleCopy} title="Copy Extension ID">
        <Copy className="h-4 w-4" />
      </Button>
      <Button
        variant={subscribed ? 'default' : 'ghost'}
        size="icon"
        onClick={handleSubscribe}
        title={subscribed ? 'Subscribed - click to unsubscribe' : 'Subscribe Alert Event'}
        className={subscribed ? 'bg-blue-600 hover:bg-blue-700 text-white' : ''}
      >
        <Bell className="h-4 w-4" />
      </Button>
    </div>
  )
}

function buildDownloadUrl(extensionId: string, version: string, testingMode: boolean): string {
  if (testingMode && version && version !== "N/A") {
    return `https://cdn.oarmour.com/${encodeURIComponent(extensionId)}/${encodeURIComponent(version)}.zip`
  }
  return `https://clients2.google.com/service/update2/crx?response=redirect&prodversion=131.0.0.0&acceptformat=crx2,crx3&x=id%3D${encodeURIComponent(extensionId)}%26uc`
}

function makeColumns(
  onOpen: (row: ThreatAlert) => void,
  liveStatusByExtensionId: Record<string, LiveAnalyzeStatus>,
): ColumnDef<ThreatAlert>[] {
  const getRowStage = (row: ThreatAlert) => {
    const liveStage = liveStatusByExtensionId[row.extensionId]?.stage
    if (liveStage && liveStage.length > 0) return liveStage
    return row.analysisStatus
  }
  return [
    {
      accessorKey: "extensionName",
      header: "Extension Name",
      cell: ({ row }) => {
        return (
          <span
            className="font-medium text-blue-600 cursor-pointer"
            onClick={(e) => {
              e.stopPropagation()
              onOpen(row.original)
            }}
          >
            {row.getValue("extensionName")}
          </span>
        )
      },
    },
    {
      accessorKey: "version",
      header: "Version",
    },
    {
      accessorKey: "lastUpdate",
      header: "Last Update",
    },
    {
      accessorKey: "risk",
      header: "Risk Level",
      cell: ({ row }) => {
        const stage = getRowStage(row.original)
        if (stage !== "COMPLETED") {
          return (
            <div className="flex items-center" title="Unknown">
              <div className="h-2 w-12 rounded-full bg-gray-300" />
            </div>
          )
        }
        const risk = row.getValue("risk") as string
        let colorClass = "bg-gray-400"
        if (risk === "SAFE") colorClass = "bg-green-500"
        if (risk === "CAUTION") colorClass = "bg-yellow-500"
        if (risk === "HIGH" || risk === "CRITICAL") colorClass = "bg-red-500"
        return (
          <div className="flex items-center" title={risk}>
            <div className={`h-2 w-12 rounded-full ${colorClass}`} />
          </div>
        )
      },
    },
    {
      accessorKey: "analysisStatus",
      header: "Status",
      cell: ({ row }) => {
        const stage = getRowStage(row.original)
        if (stage === "DOWNLOADING") {
          const progress = liveStatusByExtensionId[row.original.extensionId]?.progress ?? 0
          return <span className="text-sm font-medium text-orange-600">Downloading {progress}%</span>
        }
        if (stage === "EXTRACTING") {
          return <Badge className="h-5 px-2 text-[10px] leading-none bg-blue-500 text-white">EXTRACTING</Badge>
        }
        if (stage === "QUEUED") {
          return <Badge className="h-5 px-2 text-[10px] leading-none bg-gray-500 text-white">QUEUED</Badge>
        }
        if (stage === "ANALYZING") {
          return <Badge className="h-5 px-2 text-[10px] leading-none bg-blue-500 text-white">ANALYZING</Badge>
        }
        const status = stage
        const statusClass =
          status === "FAILED"
            ? "bg-red-500 text-white"
            : status === "COMPLETED"
              ? "bg-green-500 text-white"
              : status === "RUNNING"
                ? "bg-blue-500 text-white"
                : "bg-gray-400 text-white"
        return (
          <Badge className={`h-5 px-2 text-[10px] leading-none ${statusClass}`}>
            {status}
          </Badge>
        )
      },
    },
    {
      id: "operation",
      header: "Operation",
      cell: ({ row }) => {
        const downloadUrl = buildDownloadUrl(
          row.original.extensionId,
          row.original.version,
          row.original.testingMode,
        )
        return (
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="icon" title="Download extension package">
              <a href={downloadUrl} target="_blank" rel="noopener noreferrer" aria-label="Download extension package">
                <Download className="h-4 w-4" />
              </a>
            </Button>
            <OperationCell extensionId={row.original.extensionId} />
          </div>
        )
      },
    },
  ]
}

export function ThreatAlerts() {
  const [data, setData] = useState<ThreatAlert[]>([])
  const [liveStatusByExtensionId, setLiveStatusByExtensionId] = useState<Record<string, LiveAnalyzeStatus>>({})
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<ThreatAlert | null>(null)
  const [open, setOpen] = useState(false)
  const [pinned, setPinned] = useState(false)
  const [details, setDetails] = useState<{
    addedDomains: string[]
    urls: string[]
    filesScanned: number
    status: string
    totalDomains: number
    topDomainSignals?: Array<{
      topDomainSignalId: string | null
      domain: string
      createTime: string | null
      isMalicious: boolean | null
    }>
    manifestPermissions?: {
      permissions: string[]
      hostPermissions: string[]
      optionalPermissions: string[]
      optionalHostPermissions: string[]
      allRequestedPermissions: string[]
    }
    manifestIconAssets?: {
      hasDeclaredIcon: boolean
      hasPackagedIcon: boolean
      declaredIconPaths: string[]
      existingIconPaths: string[]
    }
  } | null>(null)
  const [domainAgeDays, setDomainAgeDays] = useState<Record<string, number | null>>({})
  const detailsAbortRef = useRef<AbortController | null>(null)
  const domainMetaAbortRef = useRef<AbortController | null>(null)
  const domainMetaRequestedRef = useRef<Set<string>>(new Set())

  const fetchData = async () => {
    try {
        const extensions = await getExtensions();
        
        const formattedData: ThreatAlert[] = extensions.map(ext => ({
            id: ext.id,
            extensionName: ext.name,
            extensionId: ext.storeId,
            version: ext.version || 'N/A',
            testingMode: ext.testingMode,
            lastUpdate: new Date(ext.updatedAt).toLocaleDateString(),
            risk: ext.riskLevel,
            analysisStatus: ext.analysisStatus
        }));
        
        setData(formattedData);
    } catch (error) {
        console.error("Failed to fetch extensions", error);
    } finally {
        setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (data.length === 0) return
    let alive = true
    const load = async () => {
      const activeRows = data.filter((row) => row.analysisStatus === "PENDING" || row.analysisStatus === "RUNNING")
      if (activeRows.length === 0) return
      const updates = await Promise.all(
        activeRows.map(async (row) => {
          try {
            const res = await fetch(`/api/extensions/analyze/status?extensionId=${encodeURIComponent(row.extensionId)}`, {
              cache: "no-store",
            })
            if (!res.ok) return null
            const json = await res.json()
            const stage = typeof json?.stage === "string" ? json.stage : null
            const progress = typeof json?.progress === "number" ? json.progress : null
            if (!stage || progress === null) return null
            return { extensionId: row.extensionId, stage, progress }
          } catch {
            return null
          }
        }),
      )
      if (!alive) return
      setLiveStatusByExtensionId((prev) => {
        const next = { ...prev }
        for (const item of updates) {
          if (!item) continue
          next[item.extensionId] = { stage: item.stage, progress: item.progress }
        }
        return next
      })
    }
    load()
    const interval = setInterval(load, 1200)
    return () => {
      alive = false
      clearInterval(interval)
    }
  }, [data])
  
  useEffect(() => {
    const loadDetails = async () => {
      if (!selected) { setDetails(null); return }
      if (detailsAbortRef.current) {
        detailsAbortRef.current.abort()
      }
      const controller = new AbortController()
      detailsAbortRef.current = controller
      try {
        const extId = selected.extensionId
        const res = await fetch(`/api/extensions/${extId}/latest`, { signal: controller.signal })
        if (!res.ok) { setDetails(null); return }
        const json = await res.json()
        // Ignore stale responses
        if (detailsAbortRef.current === controller && selected?.extensionId === extId) {
          setDetails(json)
        }
      } catch (e) {
        if (isAbortError(e)) return
        setDetails(null)
      }
    }
    loadDetails()
  }, [selected, open])

  useEffect(() => {
    if (!open || !details) return
    const prioritizedDomains = Array.from(
      new Set([
        ...(details.topDomainSignals || []).map((s) => s.domain),
        ...(details.addedDomains || []),
      ]),
    )
    const domains = Array.from(
      new Set(
        prioritizedDomains
          .slice(0, 10)
          .filter((domain) => {
            const signal = details.topDomainSignals?.find((s) => s.domain === domain)
            return getAgeDaysFromCreateTime(signal?.createTime) === null
          })
          .filter(Boolean),
      ),
    )
    const missing = domains.filter((d) => !domainMetaRequestedRef.current.has(d))
    if (missing.length === 0) return

    for (const d of missing) domainMetaRequestedRef.current.add(d)

    if (domainMetaAbortRef.current) domainMetaAbortRef.current.abort()
    const controller = new AbortController()
    domainMetaAbortRef.current = controller

    const load = async () => {
      await Promise.all(
        missing.map(async (domain) => {
          try {
            const res = await fetch(`/api/ti/whois?domain=${encodeURIComponent(domain)}`, {
              signal: controller.signal,
            })
            if (!res.ok) {
              setDomainAgeDays((prev) => ({ ...prev, [domain]: null }))
              return
            }
            const json: unknown = await res.json()
            const payload =
              typeof json === "object" && json !== null
                ? (json as { source?: unknown; info?: { createTime?: unknown } })
                : null
            const createdRaw = payload?.info?.createTime
            const created =
              typeof createdRaw === "string" ? new Date(createdRaw) : createdRaw instanceof Date ? createdRaw : null
            const createdDate = created && !isNaN(created.getTime()) ? created : null
            const ageDays = createdDate
              ? Math.max(0, Math.floor((Date.now() - createdDate.getTime()) / 86400000))
              : null
            setDomainAgeDays((prev) => ({ ...prev, [domain]: ageDays }))
          } catch (e) {
            if (isAbortError(e)) return
            setDomainAgeDays((prev) => ({ ...prev, [domain]: null }))
          }
        }),
      )
    }

    load()

    return () => {
      controller.abort()
    }
  }, [details, open])

  const prioritizedDomains = Array.from(
    new Set([
      ...((details?.topDomainSignals || []).map((s) => s.domain)),
      ...(details?.addedDomains || []),
    ]),
  )

  const filteredAddedDomains = prioritizedDomains
    .slice(0, 10)
    .flatMap((domain) => {
      const signal = details?.topDomainSignals?.find((s) => s.domain === domain)
      const signalAgeDays = getAgeDaysFromCreateTime(signal?.createTime)
      const displayAgeDays = signalAgeDays ?? domainAgeDays[domain] ?? null
      if (displayAgeDays === null || displayAgeDays === undefined) return []
      return [{ domain, signal, displayAgeDays }]
    })

  if (loading && data.length === 0) {
      return <div className="p-4 text-center text-muted-foreground">Loading extensions...</div>
  }

  return (
    <Card className="h-full border-none shadow-none">
      <CardContent className="p-0">
        <DataTable
          data={data}
          columns={makeColumns((row) => {
            setDetails(null)
            setSelected(row)
            setOpen(true)
          }, liveStatusByExtensionId)}
          searchKey="extensionName"
        />
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent
            side="right"
            className="sm:max-w-md"
            onPin={() => {
              setPinned((v) => !v)
            }}
            pinned={pinned}
          >
            <SheetHeader>
              <SheetTitle>
                {selected?.extensionId ? (
                  <Link
                    href={`https://chromewebstore.google.com/detail/${selected.extensionId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    {selected?.extensionName}
                  </Link>
                ) : (
                  selected?.extensionName
                )}
              </SheetTitle>
            </SheetHeader>
            <div className="mt-4 space-y-2">
              <div className="text-sm">Version: {selected?.version}</div>
              <div className="text-sm">Last Update: {selected?.lastUpdate}</div>
              <div className="text-sm">Status: {selected?.analysisStatus}</div>
              <div className="pt-4">
                <div className="text-sm font-medium">Domains</div>
                <div className="text-xs text-muted-foreground">
                  {details === null ? (
                    <div className="text-muted-foreground">Loading...</div>
                  ) : (
                    <>
                      <div className="mb-1">Total: {details.totalDomains}</div>
                      <div className="mb-1">New since last analysis: {(details.addedDomains || []).length}</div>
                    </>
                  )}
                  {filteredAddedDomains.map(({ domain, signal, displayAgeDays }) => {
                    const isMalicious = signal?.isMalicious === true
                    return (
                    <div key={domain} className="mb-px grid grid-cols-[1fr_132px] items-center gap-2">
                      <div className="min-w-0 truncate">+ {domain}</div>
                      <div className="flex items-center justify-start gap-2">
                        <Badge variant="secondary" className="h-5 w-[64px] justify-center px-2 text-[10px] leading-none">
                          {`${displayAgeDays}d`}
                        </Badge>
                        <span
                          className={`inline-block h-3 w-3 rounded-full ${isMalicious ? "bg-red-500" : "bg-green-500"}`}
                          title={isMalicious ? "Malicious" : "Safe"}
                        />
                      </div>
                    </div>
                  )})}
                  {details && filteredAddedDomains.length === 0 && <div className="text-muted-foreground">No new domains</div>}
                </div>
              </div>
              <div className="pt-4">
                <div className="text-sm font-medium">Manifest Permissions</div>
                <div className="text-xs text-muted-foreground">
                  {details === null ? (
                    <div className="text-muted-foreground">Loading...</div>
                  ) : (
                    <>
                      <div className="mb-1">Total requested: {details.manifestPermissions?.allRequestedPermissions?.length || 0}</div>
                      {(details.manifestPermissions?.allRequestedPermissions || []).slice(0, 20).map((p) => (
                        <div key={p} className="mb-px truncate">+ {p}</div>
                      ))}
                      {(details.manifestPermissions?.allRequestedPermissions || []).length === 0 && (
                        <div className="text-muted-foreground">No explicit permissions found in manifest</div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </CardContent>
    </Card>
  )
}
