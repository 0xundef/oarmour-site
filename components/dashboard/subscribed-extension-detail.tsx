"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { AiTestingProcedureContent } from "@/components/ai-testing/procedure-content"
import type { AiTestingLatestPayload } from "@/lib/ai-testing-display"
import { AiTestingNovelDomains } from "@/components/dashboard/ai-testing-novel-domains"
import { formatDomainAgeDisplay } from "@/lib/format-domain-age"
import { formatFindingRunLabel } from "@/lib/format-finding-run-time"
import { normalizeExtensionVersion, versionsAligned } from "@/lib/workbench-check-items"
import type { AiTestingNetworkLog } from "@/lib/ai-testing-network"
import { Link2, Maximize2, Minimize2 } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"

type AiTestingRecordingStep = {
  time: string
  thinking: string
  image: string
}

type AiTestingResponse = {
  records?: AiTestingRecordingStep[]
  assetBaseUrl?: string
  network?: AiTestingNetworkLog | null
  aiAnalysis?: AiTestingLatestPayload['aiAnalysis']
  status?: string | null
  runId?: string
  version?: string
}

type SubscribedExtensionDetailProps = {
  extensionId: string
  extensionName: string
  version: string
  lastUpdate: string
  analysisStatus: string
  risk: string
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

export function SubscribedExtensionDetail(props: SubscribedExtensionDetailProps) {
  const { toast } = useToast()
  const [details, setDetails] = useState<{
    staticAnalyzedAt?: string | null
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
  } | null>(null)
  const [domainAgeDays, setDomainAgeDays] = useState<Record<string, number | null>>({})
  const [aiTestingPayload, setAiTestingPayload] = useState<AiTestingLatestPayload | null>(null)
  const [aiTestingSummaryLoading, setAiTestingSummaryLoading] = useState(true)
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

  useEffect(() => {
    const loadDetails = async () => {
      if (detailsAbortRef.current) {
        detailsAbortRef.current.abort()
      }
      const controller = new AbortController()
      detailsAbortRef.current = controller
      try {
        const res = await fetch(`/api/extensions/${props.extensionId}/latest`, { signal: controller.signal })
        if (!res.ok) {
          setDetails(null)
          return
        }
        const json = await res.json()
        if (detailsAbortRef.current === controller) {
          setDetails(json)
        }
      } catch (e) {
        if (isAbortError(e)) return
        setDetails(null)
      }
    }
    loadDetails()
  }, [props.extensionId])

  useEffect(() => {
    const loadAiTestingSummary = async () => {
      setAiTestingSummaryLoading(true)
      try {
        const staticVersion = normalizeExtensionVersion(props.version)
        const aiUrl =
          staticVersion.length > 0
            ? `/api/ai-testing/${encodeURIComponent(props.extensionId)}/latest?version=${encodeURIComponent(staticVersion)}`
            : `/api/ai-testing/${encodeURIComponent(props.extensionId)}/latest`
        const res = await fetch(aiUrl, { cache: 'no-store' })
        if (!res.ok) {
          setAiTestingPayload(null)
          return
        }
        const json = (await res.json()) as AiTestingLatestPayload
        const aligned =
          staticVersion.length > 0 && versionsAligned(staticVersion, json.version ?? '')
        if (aligned) {
          setAiTestingPayload(json)
        } else {
          setAiTestingPayload(null)
        }
      } catch {
        setAiTestingPayload(null)
      } finally {
        setAiTestingSummaryLoading(false)
      }
    }
    loadAiTestingSummary()
  }, [props.extensionId, props.version])

  useEffect(() => {
    if (!details) return
    const prioritizedDomains = Array.from(new Set([...(details.topDomainSignals || []).map((s) => s.domain), ...(details.addedDomains || [])]))
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
            const res = await fetch(`/api/ti/whois?domain=${encodeURIComponent(domain)}`, { signal: controller.signal })
            if (!res.ok) {
              setDomainAgeDays((prev) => ({ ...prev, [domain]: null }))
              return
            }
            const json: unknown = await res.json()
            const payload = typeof json === "object" && json !== null ? (json as { info?: { createTime?: unknown } }) : null
            const createdRaw = payload?.info?.createTime
            const created = typeof createdRaw === "string" ? new Date(createdRaw) : createdRaw instanceof Date ? createdRaw : null
            const createdDate = created && !isNaN(created.getTime()) ? created : null
            const ageDays = createdDate ? Math.max(0, Math.floor((Date.now() - createdDate.getTime()) / 86400000)) : null
            setDomainAgeDays((prev) => ({ ...prev, [domain]: ageDays }))
          } catch (e) {
            if (isAbortError(e)) return
            setDomainAgeDays((prev) => ({ ...prev, [domain]: null }))
          }
        }),
      )
    }
    load()
    return () => controller.abort()
  }, [details])

  useEffect(() => {
    if (!aiDetailOpen || !props.extensionId) return
    const loadAiDetail = async () => {
      setAiDetailLoading(true)
      setAiDetailError("")
      try {
        const url = `/api/ai-testing/${encodeURIComponent(props.extensionId)}/latest`
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
          setAiDetailNetwork(null)
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
        if (parsed.length === 0) setAiDetailError("AI testing record is empty.")
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
  }, [aiDetailOpen, props.extensionId])

  const prioritizedDomains = Array.from(new Set([...(details?.topDomainSignals || []).map((s) => s.domain), ...(details?.addedDomains || [])]))
  const filteredAddedDomains = prioritizedDomains.slice(0, 10).flatMap((domain) => {
    const signal = details?.topDomainSignals?.find((s) => s.domain === domain)
    const signalAgeDays = getAgeDaysFromCreateTime(signal?.createTime)
    const displayAgeDays = signalAgeDays ?? domainAgeDays[domain] ?? null
    if (displayAgeDays === null || displayAgeDays === undefined) return []
    return [{ domain, signal, displayAgeDays }]
  })

  const staticScanLabel = formatFindingRunLabel('static', details?.staticAnalyzedAt)

  const handleCopyAiShareLink = async () => {
    try {
      const shareUrl = `${window.location.origin}/ai-testing/${encodeURIComponent(props.extensionId)}`
      await navigator.clipboard.writeText(shareUrl)
      toast({ description: "AI testing share link copied" })
    } catch {
      toast({ variant: "destructive", description: "Failed to copy share link. Please allow clipboard access." })
    }
  }

  return (
    <div className="flex-1 space-y-4 p-4 pt-2 md:px-8 md:pb-8 md:pt-4">
      <Card>
        <CardContent className="p-6">
          <div className="space-y-2">
            <div className="text-3xl font-semibold">
              <Link
                href={`https://chromewebstore.google.com/detail/${props.extensionId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                {props.extensionName}
              </Link>
            </div>
            <div className="text-2xl">Version: {props.version}</div>
            <div className="text-2xl">Last Update: {props.lastUpdate}</div>
            <div className="text-2xl">Status: {props.analysisStatus}</div>
          </div>

          <div className="mt-8 space-y-6">
            <div>
              <div className="text-3xl font-semibold tracking-wide">STATIC</div>
              <div className="text-2xl text-muted-foreground">
                {details === null ? (
                  <div>Loading...</div>
                ) : (
                  <>
                    <div>{staticScanLabel}</div>
                    <div>Total: {details.totalDomains}</div>
                    <div>New since last analysis: {(details.addedDomains || []).length}</div>
                    <div>Files scanned (static): {details.filesScanned}</div>
                    <div>URLs detected (static): {(details.urls || []).length}</div>
                  </>
                )}
              </div>
              <div className="mt-2 space-y-1 text-2xl text-muted-foreground">
                {filteredAddedDomains.map(({ domain, signal, displayAgeDays }) => {
                  const isMalicious = signal?.isMalicious === true
                  return (
                    <div key={domain} className="grid grid-cols-[1fr_7rem] items-center gap-2">
                      <div className="min-w-0 truncate">+ {domain}</div>
                      <div className="flex shrink-0 items-center justify-end gap-2">
                        <Badge
                          variant="secondary"
                          className="h-8 w-[5.75rem] shrink-0 justify-center whitespace-nowrap px-1 text-xl leading-none"
                        >
                          {formatDomainAgeDisplay(displayAgeDays)}
                        </Badge>
                        <span className={`inline-block h-5 w-5 rounded-full ${isMalicious ? "bg-red-500" : "bg-green-500"}`} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between gap-2">
                <div className="text-3xl font-semibold tracking-wide">DYNAMIC</div>
                <Button
                  variant="link"
                  className="h-auto shrink-0 p-0 text-2xl text-blue-600 underline underline-offset-2 hover:text-blue-700"
                  type="button"
                  onClick={() => setAiDetailOpen(true)}
                >
                  See Details
                </Button>
              </div>
              <div className="mt-2 space-y-1 text-2xl text-muted-foreground">
                <AiTestingNovelDomains
                  payload={aiTestingPayload}
                  loading={aiTestingSummaryLoading}
                  size="detail"
                />
              </div>
            </div>

            <div>
              <div className="text-3xl font-semibold">Manifest Permissions</div>
              <div className="text-2xl text-muted-foreground">
                {details === null ? (
                  <div>Loading...</div>
                ) : (
                  <>
                    <div>Total requested: {details.manifestPermissions?.allRequestedPermissions?.length || 0}</div>
                    {(details.manifestPermissions?.allRequestedPermissions || []).slice(0, 20).map((p) => (
                      <div key={p}>+ {p}</div>
                    ))}
                  </>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={aiDetailOpen}
        onOpenChange={(nextOpen) => {
          setAiDetailOpen(nextOpen)
          if (!nextOpen) setAiDetailFullscreen(false)
        }}
      >
        <DialogContent className={`overflow-hidden ${aiDetailFullscreen ? "h-[92vh] w-[96vw] max-w-[96vw]" : "max-h-[80vh] max-w-3xl"}`}>
          <Button variant="ghost" size="icon" type="button" className="absolute right-20 top-3 h-8 w-8" title="Copy share link" onClick={handleCopyAiShareLink}>
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
            <DialogTitle>DYNAMIC</DialogTitle>
            <DialogDescription>
              Automated browser steps and captured network traffic for {props.extensionName}.
            </DialogDescription>
          </DialogHeader>
          <div className={`${aiDetailFullscreen ? "max-h-[78vh]" : "max-h-[64vh]"} overflow-y-auto pr-1`}>
            <AiTestingProcedureContent
              extensionId={props.extensionId}
              records={aiDetailRecords}
              loading={aiDetailLoading}
              error={aiDetailError}
              assetBaseUrl={aiDetailAssetBaseUrl}
              network={aiDetailNetwork}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
