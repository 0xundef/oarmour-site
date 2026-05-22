"use client"

import { Card, CardContent } from "@/components/ui/card"
import { DataTable } from "@/components/ui/data-table"
import { ColumnDef } from "@tanstack/react-table"
import { Button } from "@/components/ui/button"
import { Copy, Bell, Download, Maximize2, Minimize2, Link2, ShieldCheck, ShieldAlert, ScanSearch, FolderKanban, Sparkles } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useEffect, useMemo, useState, useRef } from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { AiTestingProcedureContent } from "@/components/ai-testing/procedure-content"
import type { AiTestingNetworkLog } from "@/lib/ai-testing-network"
import { buildAiTestingSummary, type AiTestingLatestPayload, type AiTestingSummary } from "@/lib/ai-testing-display"
import Link from "next/link"
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts"
import { useSearchParams } from "next/navigation"
import { buildDashboardDownloadUrl, usesPrefixBasedVersionCheck } from "@/lib/package-download-url"
import { formatDomainAgeDisplay } from "@/lib/format-domain-age"

type ThreatAlert = {
  id: string
  extensionName: string
  extensionId: string
  version: string
  packageDownloadPrefix: string | null
  packageDownloadSuffix: string | null
  lastUpdate: string
  risk: string
  analysisStatus: string
}

type LiveAnalyzeStatus = {
  stage: string
  progress: number
}

type AiTestingRecordingStep = {
  time: string
  thinking: string
  image: string
}

type AiTestingResponse = {
  records?: AiTestingRecordingStep[]
  assetBaseUrl?: string
  network?: AiTestingNetworkLog | null
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

const isCompletedStatus = (status: string) => status === "COMPLETED"
const isInProgressStatus = (status: string) =>
  status === "PENDING" || status === "RUNNING" || status === "DOWNLOADING" || status === "EXTRACTING" || status === "QUEUED" || status === "ANALYZING"
const isHighOrCritical = (risk: string) => risk === "HIGH" || risk === "CRITICAL"

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
        title={subscribed ? 'Subscribed - click to unsubscribe' : 'Subscribe to alert events'}
        className={subscribed ? 'bg-blue-600 hover:bg-blue-700 text-white' : ''}
        aria-label={subscribed ? 'Subscribed to alert events' : 'Not subscribed to alert events'}
        aria-pressed={subscribed}
      >
        <Bell className="h-4 w-4" />
      </Button>
    </div>
  )
}

function makeColumns(
  onOpen: (row: ThreatAlert) => void,
  liveStatusByExtensionId: Record<string, LiveAnalyzeStatus>,
): ColumnDef<ThreatAlert>[] {
  const getRowStage = (row: ThreatAlert) => {
    const liveStage = liveStatusByExtensionId[row.extensionId]?.stage
    if (isInProgressStatus(row.analysisStatus) && liveStage && liveStage.length > 0) return liveStage
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
        const downloadUrl = buildDashboardDownloadUrl(
          row.original.extensionId,
          row.original.version,
          row.original.packageDownloadPrefix,
          row.original.packageDownloadSuffix,
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
  const { toast } = useToast()
  const searchParams = useSearchParams()
  const [data, setData] = useState<ThreatAlert[]>([])
  const [liveStatusByExtensionId, setLiveStatusByExtensionId] = useState<Record<string, LiveAnalyzeStatus>>({})
  const [loading, setLoading] = useState(true)
  const [completedScanActions, setCompletedScanActions] = useState(0)
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
  const [aiTestingSummary, setAiTestingSummary] = useState<AiTestingSummary | null>(null)
  const [aiTestingSummaryLoading, setAiTestingSummaryLoading] = useState(false)
  const aiTestingSummaryAbortRef = useRef<AbortController | null>(null)
  const [domainAgeDays, setDomainAgeDays] = useState<Record<string, number | null>>({})
  const [aiDetailOpen, setAiDetailOpen] = useState(false)
  const [aiDetailFullscreen, setAiDetailFullscreen] = useState(false)
  const [aiDetailLoading, setAiDetailLoading] = useState(false)
  const [aiDetailError, setAiDetailError] = useState("")
  const [aiDetailRecords, setAiDetailRecords] = useState<AiTestingRecordingStep[]>([])
  const [aiDetailAssetBaseUrl, setAiDetailAssetBaseUrl] = useState("")
  const [aiDetailNetwork, setAiDetailNetwork] = useState<AiTestingNetworkLog | null>(null)
  const detailsAbortRef = useRef<AbortController | null>(null)
  const domainMetaAbortRef = useRef<AbortController | null>(null)
  const domainMetaRequestedRef = useRef<Set<string>>(new Set())
  const autoOpenedExtensionIdRef = useRef<string | null>(null)

  const overview = useMemo(() => {
    const total = data.length
    const completedScans = completedScanActions
    const highCritical = data.filter((row) => isHighOrCritical(row.risk)).length
    const findings = highCritical
    const aiTesting = data.filter((row) => usesPrefixBasedVersionCheck(row.packageDownloadPrefix)).length
    const remediated = data.filter((row) => row.risk === "SAFE" && isCompletedStatus(row.analysisStatus)).length
    const inProgress = data.filter((row) => isInProgressStatus(row.analysisStatus)).length
    const awaitingConfirmation = data.filter((row) => isHighOrCritical(row.risk) && isCompletedStatus(row.analysisStatus)).length
    const confirmedMalicious = awaitingConfirmation
    const awaitingFeedback = Math.max(0, confirmedMalicious - remediated)
    const safeConfirmed = remediated

    const severityCount = {
      safe: 0,
      low: 0,
      medium: 0,
      high: 0,
      critical: 0,
    }

    for (const row of data) {
      if (row.risk === "SAFE") severityCount.safe += 1
      else if (row.risk === "CAUTION") severityCount.medium += 1
      else if (row.risk === "HIGH") severityCount.high += 1
      else if (row.risk === "CRITICAL") severityCount.critical += 1
      else severityCount.low += 1
    }

    const severityData = [
      { name: "Safe", value: severityCount.safe, color: "#16a34a" },
      { name: "Low", value: severityCount.low, color: "#94a3b8" },
      { name: "Medium", value: severityCount.medium, color: "#eab308" },
      { name: "High", value: severityCount.high, color: "#f97316" },
      { name: "Critical", value: severityCount.critical, color: "#dc2626" },
    ]

    return {
      total,
      completedScans,
      findings,
      highCritical,
      aiTesting,
      remediated,
      inProgress,
      awaitingConfirmation,
      confirmedMalicious,
      awaitingFeedback,
      safeConfirmed,
      severityData,
    }
  }, [completedScanActions, data])

  const processingRows = useMemo(() => {
    const total = Math.max(1, overview.total)
    return [
      { key: "in-progress", label: "Detection In Progress", count: overview.inProgress },
      { key: "awaiting-confirmation", label: "Awaiting Confirmation", count: overview.awaitingConfirmation },
      { key: "confirmed-malicious", label: "Confirmed Malicious", count: overview.confirmedMalicious },
      { key: "awaiting-feedback", label: "Awaiting Feedback", count: overview.awaitingFeedback },
      { key: "safe-confirmed", label: "Safe / Closed", count: overview.safeConfirmed },
    ].map((row) => ({
      ...row,
      percent: Math.round((row.count / total) * 100),
    }))
  }, [overview])

  const fetchData = async () => {
    try {
        const res = await fetch('/api/extensions', { cache: 'no-store' })
        if (!res.ok) {
          console.error('Failed to fetch extensions', res.status, await res.text().catch(() => ''))
          return
        }
        const payload = await res.json() as {
          extensions?: Array<{
            id: string
            storeId: string
            name: string
            version: string | null
            packageDownloadPrefix: string | null
            packageDownloadSuffix: string | null
            updatedAt: string
            riskLevel: string
            analysisStatus: string
          }>
          metrics?: { completedScanActions?: number }
        }
        const extensions = payload.extensions ?? []

        const formattedData: ThreatAlert[] = extensions.map((ext) => ({
            id: ext.id,
            extensionName: ext.name,
            extensionId: ext.storeId,
            version: ext.version || 'N/A',
            packageDownloadPrefix: ext.packageDownloadPrefix ?? null,
            packageDownloadSuffix: ext.packageDownloadSuffix ?? null,
            lastUpdate: new Date(ext.updatedAt).toLocaleDateString(),
            risk: ext.riskLevel,
            analysisStatus: ext.analysisStatus,
        }))

        setData(formattedData)
        setCompletedScanActions(payload.metrics?.completedScanActions ?? 0)
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
    const wantedId = (searchParams.get("extensionId") || "").trim()
    if (!wantedId || data.length === 0) return
    if (autoOpenedExtensionIdRef.current === wantedId) return
    const matched = data.find((row) => row.extensionId === wantedId)
    if (!matched) return
    autoOpenedExtensionIdRef.current = wantedId
    setDetails(null)
    setSelected(matched)
    setOpen(true)
  }, [searchParams, data])

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
    const loadAiTestingSummary = async () => {
      if (!selected || !open) {
        setAiTestingSummary(null)
        setAiTestingSummaryLoading(false)
        return
      }
      if (aiTestingSummaryAbortRef.current) {
        aiTestingSummaryAbortRef.current.abort()
      }
      const controller = new AbortController()
      aiTestingSummaryAbortRef.current = controller
      setAiTestingSummaryLoading(true)
      try {
        const extId = selected.extensionId
        const res = await fetch(`/api/ai-testing/${encodeURIComponent(extId)}/latest`, {
          signal: controller.signal,
          cache: 'no-store',
        })
        if (aiTestingSummaryAbortRef.current !== controller || selected.extensionId !== extId) return
        if (!res.ok) {
          setAiTestingSummary(buildAiTestingSummary(null))
          return
        }
        const json = (await res.json()) as AiTestingLatestPayload
        setAiTestingSummary(buildAiTestingSummary(json))
      } catch (e) {
        if (isAbortError(e)) return
        if (aiTestingSummaryAbortRef.current === controller) {
          setAiTestingSummary(buildAiTestingSummary(null))
        }
      } finally {
        if (aiTestingSummaryAbortRef.current === controller) {
          setAiTestingSummaryLoading(false)
        }
      }
    }
    loadAiTestingSummary()
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

  useEffect(() => {
    if (!aiDetailOpen || !selected?.extensionId) return
    const loadAiDetail = async () => {
      setAiDetailLoading(true)
      setAiDetailError("")
      try {
        const url = `/api/ai-testing/${encodeURIComponent(selected.extensionId)}/latest`
        const res = await fetch(url, { cache: "no-store" })
        if (!res.ok) {
          setAiDetailRecords([])
          setAiDetailAssetBaseUrl("")
          setAiDetailNetwork(null)
          setAiDetailError("No AI testing record found for this extension.")
          return
        }
        const json: AiTestingResponse = await res.json()
        if (!Array.isArray(json.records)) {
          setAiDetailRecords([])
          setAiDetailAssetBaseUrl("")
          setAiDetailError("AI testing record format is invalid.")
          return
        }
        const parsed = json.records.flatMap((item): AiTestingRecordingStep[] => {
          if (!item || typeof item !== "object") return []
          const obj = item as Record<string, unknown>
          const time = typeof obj.time === "string" ? obj.time : ""
          const thinking = typeof obj.thinking === "string" ? obj.thinking : ""
          const image = typeof obj.image === "string" ? obj.image : ""
          if (!time || !thinking || !image) return []
          return [{ time, thinking, image }]
        })
        setAiDetailRecords(parsed)
        setAiDetailAssetBaseUrl(typeof json.assetBaseUrl === "string" ? json.assetBaseUrl : "")
        setAiDetailNetwork(json.network ?? null)
        if (parsed.length === 0) {
          setAiDetailError("AI testing record is empty.")
        }
      } catch {
        setAiDetailRecords([])
        setAiDetailAssetBaseUrl("")
        setAiDetailNetwork(null)
        setAiDetailError("Failed to load AI testing record.")
      } finally {
        setAiDetailLoading(false)
      }
    }
    loadAiDetail()
  }, [aiDetailOpen, selected?.extensionId])

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

  const handleCopyAiShareLink = async () => {
    if (!selected?.extensionId) return
    try {
      const shareUrl = `${window.location.origin}/ai-testing/${encodeURIComponent(selected.extensionId)}`
      await navigator.clipboard.writeText(shareUrl)
      toast({ description: "AI testing share link copied" })
    } catch {
      toast({
        variant: "destructive",
        description: "Failed to copy share link. Please allow clipboard access.",
      })
    }
  }

  if (loading && data.length === 0) {
      return <div className="p-4 text-center text-muted-foreground">Loading extensions...</div>
  }

  return (
    <Card className="h-full border-none shadow-none">
      <CardContent className="p-0">
        <div className="mb-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <Card>
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <div className="text-xs text-muted-foreground">Extension Managed</div>
                  <div className="text-2xl font-semibold">{overview.total}</div>
                </div>
                <FolderKanban className="h-4 w-4 text-muted-foreground" />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <div className="text-xs text-muted-foreground">Scans Completed</div>
                  <div className="text-2xl font-semibold">{overview.completedScans}</div>
                </div>
                <ScanSearch className="h-4 w-4 text-muted-foreground" />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <div className="text-xs text-muted-foreground">AI Testing</div>
                  <div className="text-2xl font-semibold text-purple-600">{overview.aiTesting}</div>
                </div>
                <Sparkles className="h-4 w-4 text-green-400" />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <div className="text-xs text-muted-foreground">Findings</div>
                  <div className="text-2xl font-semibold text-red-600">{overview.findings}</div>
                </div>
                <ShieldAlert className="h-4 w-4 text-red-500" />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <div className="text-xs text-muted-foreground">Remediated / Safe</div>
                  <div className="text-2xl font-semibold text-green-600">{overview.remediated}</div>
                </div>
                <ShieldCheck className="h-4 w-4 text-green-600" />
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-3 xl:grid-cols-5">
            <Card className="xl:col-span-3">
              <CardContent className="p-4">
                <div className="mb-3 text-sm font-medium">Severity Distribution</div>
                <div className="grid gap-2 md:grid-cols-[320px_1fr]">
                  <div className="h-[220px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={overview.severityData}
                          dataKey="value"
                          nameKey="name"
                          innerRadius={56}
                          outerRadius={84}
                          strokeWidth={3}
                          stroke="#ffffff"
                        >
                          {overview.severityData.map((entry) => (
                            <Cell key={entry.name} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value: number, name: string) => [`${value}`, name]} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="grid content-center gap-2 text-sm">
                    {overview.severityData.map((item) => (
                      <div key={item.name} className="flex items-center justify-between rounded-md border px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                          <span>{item.name}</span>
                        </div>
                        <span className="font-medium">{item.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="xl:col-span-2">
              <CardContent className="p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div className="text-sm font-medium">Processing Status</div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => toast({ description: "Confirmation workflow triggered for selected findings." })}
                    >
                      Confirm Findings
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => toast({ description: "Feedback workflow opened for security operations team." })}
                    >
                      Provide Feedback
                    </Button>
                  </div>
                </div>

                <div className="space-y-3">
                  {processingRows.map((row) => (
                    <div key={row.key} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span>{row.label}</span>
                        <span className="text-muted-foreground">{row.percent}% · {row.count}</span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-muted">
                        <div
                          className="h-2 rounded-full bg-slate-600"
                          style={{ width: `${Math.min(100, Math.max(0, row.percent))}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <DataTable
          data={data}
          columns={makeColumns((row) => {
            setDetails(null)
            setAiTestingSummary(null)
            setSelected(row)
            setOpen(true)
          }, liveStatusByExtensionId)}
          searchKey="extensionName"
          searchKeys={["extensionName", "extensionId"]}
          searchPlaceholder="Search extension name or ID..."
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
                      <div className="mb-1">Files scanned (static): {details.filesScanned}</div>
                      <div className="mb-1">URLs detected (static): {(details.urls || []).length}</div>
                    </>
                  )}
                  {filteredAddedDomains.map(({ domain, signal, displayAgeDays }) => {
                    const isMalicious = signal?.isMalicious === true
                    return (
                    <div key={domain} className="mb-px grid grid-cols-[1fr_132px] items-center gap-2">
                      <div className="min-w-0 truncate">+ {domain}</div>
                      <div className="flex items-center justify-start gap-2">
                        <Badge variant="secondary" className="h-5 w-[64px] justify-center px-2 text-[10px] leading-none">
                          {formatDomainAgeDisplay(displayAgeDays)}
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
                <div className="text-sm font-medium">AI Testing</div>
                <div className="text-xs text-muted-foreground">
                  {aiTestingSummaryLoading ? (
                    <div className="text-muted-foreground">Loading...</div>
                  ) : (
                    <>
                      <div className="mb-1">
                        Run: {aiTestingSummary?.hasRun ? aiTestingSummary.runId : '—'}
                      </div>
                      <div className="mb-1">Recording steps: {aiTestingSummary?.recordingSteps ?? 0}</div>
                      <div className="mb-1">Network requests: {aiTestingSummary?.networkRequestCount ?? 0}</div>
                      <div className="mb-1">Runtime domains: {aiTestingSummary?.runtimeDomainCount ?? 0}</div>
                      <div className="mb-1">Novel vs static: {aiTestingSummary?.novelDomainCount ?? 0}</div>
                      <div className="mb-1">
                        Malicious runtime domains: {aiTestingSummary?.maliciousSignalCount ?? 0}
                      </div>
                      <div className="mb-1">Verdict: {aiTestingSummary?.verdict ?? 'No AI testing run yet'}</div>
                    </>
                  )}
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
        <Dialog
          open={aiDetailOpen}
          onOpenChange={(nextOpen) => {
            setAiDetailOpen(nextOpen)
            if (!nextOpen) setAiDetailFullscreen(false)
          }}
        >
          <DialogContent
            className={`overflow-hidden ${
              aiDetailFullscreen ? "h-[92vh] w-[96vw] max-w-[96vw]" : "max-h-[80vh] max-w-3xl"
            }`}
          >
            <Button
              variant="ghost"
              size="icon"
              type="button"
              className="absolute right-20 top-3 h-8 w-8"
              title="Copy share link"
              onClick={handleCopyAiShareLink}
            >
              <Link2 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              type="button"
              className="absolute right-12 top-3 h-8 w-8"
              title={aiDetailFullscreen ? "Exit fullscreen" : "Fullscreen"}
              onClick={() => setAiDetailFullscreen((v) => !v)}
            >
              {aiDetailFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>
            <DialogHeader>
              <DialogTitle>AI Testing Procedure</DialogTitle>
              <DialogDescription>
                Step-by-step automated testing record for {selected?.extensionName || "the selected extension"}.
              </DialogDescription>
            </DialogHeader>
            <div className={`${aiDetailFullscreen ? "max-h-[78vh]" : "max-h-[64vh]"} overflow-y-auto pr-1`}>
              <AiTestingProcedureContent
                extensionId={selected?.extensionId || ""}
                records={aiDetailRecords}
                loading={aiDetailLoading}
                error={aiDetailError}
                assetBaseUrl={aiDetailAssetBaseUrl}
                network={aiDetailNetwork}
              />
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  )
}
