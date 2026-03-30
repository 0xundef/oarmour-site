"use client"

import { Card, CardContent } from "@/components/ui/card"
import { DataTable } from "@/components/ui/data-table"
import { ColumnDef } from "@tanstack/react-table"
import { Button } from "@/components/ui/button"
import { Copy, Bell, Play } from "lucide-react"
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
  publisher: string
  testingMode: boolean
  lastUpdate: string
  risk: string
  analysisStatus: string
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

const OperationCell = ({ extensionId, testingMode }: { extensionId: string; testingMode: boolean }) => {
  const { toast } = useToast()
  const [running, setRunning] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(extensionId)
    toast({ description: "Extension ID copied to clipboard" })
  }

  const handleSubscribe = () => {
    toast({ description: "Subscribed to alert events" })
  }

  const handleImmediateCheck = async () => {
    if (!testingMode || running) return
    setRunning(true)
    try {
      const res = await fetch("/api/monitor/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeId: extensionId }),
      })
      const payload = await res.json().catch(() => null)
      if (!res.ok) {
        const message = typeof payload?.error === "string" ? payload.error : "Immediate check failed"
        throw new Error(message)
      }
      const updatedCount = Array.isArray(payload?.updated) ? payload.updated.length : 0
      toast({
        description:
          updatedCount > 0
            ? `Immediate check finished. ${updatedCount} update(s) detected and analyzed.`
            : "Immediate check finished. No new version found.",
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : "Immediate check failed"
      toast({ variant: "destructive", description: message })
    } finally {
      setRunning(false)
    }
  }

  // analyze removed

  return (
    <div className="flex items-center gap-2">
      {testingMode ? (
        <Button
          variant="outline"
          size="sm"
          onClick={handleImmediateCheck}
          disabled={running}
          title="Run immediate check now"
        >
          <Play className="mr-1 h-3.5 w-3.5" />
          Check
        </Button>
      ) : null}
      <Button variant="ghost" size="icon" onClick={handleCopy} title="Copy Extension ID">
        <Copy className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="icon" onClick={handleSubscribe} title="Subscribe Alert Event">
        <Bell className="h-4 w-4" />
      </Button>
      {/* Analyze button removed */}
    </div>
  )
}

function makeColumns(onOpen: (row: ThreatAlert) => void): ColumnDef<ThreatAlert>[] {
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
      accessorKey: "publisher",
      header: "Publisher",
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">{row.getValue("publisher") || 'N/A'}</span>
      ),
    },
    {
      accessorKey: "lastUpdate",
      header: "Last Update",
    },
    {
      accessorKey: "risk",
      header: "Risk Level",
      cell: ({ row }) => {
        const risk = row.getValue("risk") as string
        const status = row.original.analysisStatus
        if (status === 'RUNNING' || status === 'PENDING') {
          return (
            <div className="flex items-center gap-2" title="Analysis In Progress">
              <div className="h-2 w-12 rounded-full bg-gray-300 animate-pulse" />
              <span className="text-xs text-gray-500">Analyzing...</span>
            </div>
          )
        }
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
        const status = row.original.analysisStatus
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
      cell: ({ row }) => <OperationCell extensionId={row.original.extensionId} testingMode={row.original.testingMode} />,
    },
  ]
}

export function ThreatAlerts() {
  const [data, setData] = useState<ThreatAlert[]>([])
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
            publisher: ext.publisher || 'N/A',
            testingMode: !!ext.testingMode,
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
    // Poll every 5 seconds to update status
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);
  
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
    const domains = Array.from(
      new Set(
        (details.addedDomains || [])
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
          })}
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
              <div className="text-sm">Publisher: {selected?.publisher}</div>
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
                      <div className="mb-1">New since last analysis: {details.addedDomains.length}</div>
                    </>
                  )}
                  {(details?.addedDomains || []).slice(0, 10).map((d) => {
                    const signal = details?.topDomainSignals?.find((s) => s.domain === d)
                    const isMalicious = signal?.isMalicious === true
                    const signalAgeDays = getAgeDaysFromCreateTime(signal?.createTime)
                    const displayAgeDays = signalAgeDays ?? domainAgeDays[d] ?? null
                    return (
                    <div key={d} className="mb-px grid grid-cols-[1fr_132px] items-center gap-2">
                      <div className="min-w-0 truncate">+ {d}</div>
                      <div className="flex items-center justify-start gap-2">
                        <Badge variant="secondary" className="h-5 w-[64px] justify-center px-2 text-[10px] leading-none">
                          {displayAgeDays === null || displayAgeDays === undefined ? "N/A" : `${displayAgeDays}d`}
                        </Badge>
                        <Badge
                          className={`h-5 px-2 text-[10px] leading-none ${isMalicious ? "bg-red-500 text-white" : "bg-green-500 text-white"}`}
                        >
                          {isMalicious ? "MALICIOUS" : "SAFE"}
                        </Badge>
                      </div>
                    </div>
                  )})}
                  {details && (details.addedDomains || []).length === 0 && <div className="text-muted-foreground">No new domains</div>}
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
              <div className="pt-4">
                <div className="text-sm font-medium">Manifest Icons</div>
                <div className="text-xs text-muted-foreground">
                  {details === null ? (
                    <div className="text-muted-foreground">Loading...</div>
                  ) : (
                    <>
                      <div className="mb-1">
                        Declared in manifest: {details.manifestIconAssets?.hasDeclaredIcon ? "Yes" : "No"}
                      </div>
                      <div className="mb-1">
                        Found in package: {details.manifestIconAssets?.hasPackagedIcon ? "Yes" : "No"}
                      </div>
                      {(details.manifestIconAssets?.existingIconPaths || []).slice(0, 10).map((iconPath) => (
                        <div key={iconPath} className="mb-px truncate">+ {iconPath}</div>
                      ))}
                      {(details.manifestIconAssets?.existingIconPaths || []).length === 0 && (
                        <div className="text-muted-foreground">No packaged icon file found</div>
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
