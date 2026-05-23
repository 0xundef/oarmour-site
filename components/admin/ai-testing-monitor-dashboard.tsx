"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { AiTestingRunButton } from "@/components/ai-testing/ai-testing-run-button"
import {
  loadAiTestingStatusMap,
  mergeAiTestingStatusMaps,
  type AiTestingStatusEntry,
} from "@/lib/ai-testing-status-client"
import type { AgentQueueEntry, AgentStatusEntry } from "@/lib/agent-queue"
import type {
  AiTestingQueueStatusLink,
  AiTestingStatusQueueLink,
} from "@/lib/ai-testing-queue-status"

type MonitorExtension = {
  id: string
  storeId: string
  name: string
  version: string | null
  pendingVersion?: string | null
}

type OverviewPayload = {
  queue: Array<AgentQueueEntry & { extensionName?: string }>
  statuses: Array<AgentStatusEntry & { extensionName?: string }>
  queueLinks: Array<AiTestingQueueStatusLink & { extensionName?: string }>
  statusLinks: Array<
    AiTestingStatusQueueLink & {
      extensionName?: string
      analysisStatus?: string | null
      analysisError?: string | null
    }
  >
  updatedAt?: string
}

function formatTime(iso?: string | null) {
  if (!iso) return "—"
  const d = new Date(iso)
  if (!Number.isFinite(d.getTime())) return "—"
  return d.toLocaleString()
}

function agentStatusBadge(status: string | undefined) {
  switch (status) {
    case "running":
      return <Badge className="bg-blue-600 hover:bg-blue-600">running</Badge>
    case "pending":
      return <Badge variant="secondary">pending</Badge>
    case "complete":
      return <Badge className="bg-green-600 hover:bg-green-600">complete</Badge>
    case "error":
      return <Badge variant="destructive">error</Badge>
    default:
      return <Badge variant="outline">—</Badge>
  }
}

function analysisBadge(status: string | null | undefined) {
  if (!status) return <span className="text-muted-foreground">—</span>
  const variant =
    status === "COMPLETED"
      ? "default"
      : status === "FAILED"
        ? "destructive"
        : status === "RUNNING"
          ? "secondary"
          : "outline"
  return <Badge variant={variant}>{status}</Badge>
}

function LinkedBadge({ linked }: { linked: boolean }) {
  if (!linked) {
    return (
      <Badge variant="outline" className="text-muted-foreground">
        not linked
      </Badge>
    )
  }
  return <Badge variant="default">linked</Badge>
}

export function AiTestingMonitorDashboard({
  extensions,
}: {
  extensions: MonitorExtension[]
}) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [overview, setOverview] = useState<OverviewPayload | null>(null)
  const [statusByStoreId, setStatusByStoreId] = useState<Record<string, AiTestingStatusEntry>>({})
  const [enqueueStoreId, setEnqueueStoreId] = useState(extensions[0]?.storeId ?? "")

  const selectedExtension = useMemo(
    () => extensions.find((e) => e.storeId === enqueueStoreId),
    [extensions, enqueueStoreId],
  )

  const enqueueVersion =
    selectedExtension?.pendingVersion?.trim() ||
    selectedExtension?.version?.trim() ||
    null

  const refresh = useCallback(async () => {
    try {
      const [overviewRes, statusMap] = await Promise.all([
        fetch("/api/ai-testing/overview", { cache: "no-store" }),
        loadAiTestingStatusMap(),
      ])
      if (!overviewRes.ok) {
        setError("Failed to load AI testing queue and status.")
        return
      }
      const json = (await overviewRes.json()) as OverviewPayload
      setOverview(json)
      setStatusByStoreId((prev) => mergeAiTestingStatusMaps(prev, statusMap))
      setError("")
    } catch {
      setError("Failed to load AI testing queue and status.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
    const interval = setInterval(() => void refresh(), 5000)
    return () => clearInterval(interval)
  }, [refresh])

  const handleEnqueueTriggered = (storeId: string) => {
    setStatusByStoreId((prev) => ({
      ...prev,
      [storeId]: { agentStatus: "pending", analysisStatus: null, analysisError: null },
    }))
    void refresh()
  }

  const queueRows = overview?.queueLinks ?? []
  const statusRows = overview?.statusLinks ?? []

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Enqueue AI test</CardTitle>
          <CardDescription>
            Add a task to <code className="text-xs">incoming_queue.json</code>. The agent picks the
            latest unhandled entry.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground" htmlFor="ai-test-extension">
              Extension
            </label>
            <select
              id="ai-test-extension"
              className="flex h-9 min-w-[14rem] rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
              value={enqueueStoreId}
              onChange={(e) => setEnqueueStoreId(e.target.value)}
            >
              {extensions.map((ext) => (
                <option key={ext.storeId} value={ext.storeId}>
                  {ext.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">Version</div>
            <div className="text-sm font-mono">{enqueueVersion ?? "N/A"}</div>
          </div>
          {selectedExtension ? (
            <AiTestingRunButton
              storeId={selectedExtension.storeId}
              extensionName={selectedExtension.name}
              version={enqueueVersion}
              statusEntry={statusByStoreId[selectedExtension.storeId]}
              onTriggered={handleEnqueueTriggered}
            />
          ) : null}
        </CardContent>
      </Card>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">In Queue</CardTitle>
            <CardDescription>
              Rows from <code className="text-xs">incoming_queue.json</code>
              {overview?.updatedAt ? ` · updated ${formatTime(overview.updatedAt)}` : ""}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {loading && queueRows.length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted-foreground">Loading…</p>
            ) : queueRows.length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted-foreground">Queue is empty.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="px-4">Extension</TableHead>
                      <TableHead className="px-4">Version</TableHead>
                      <TableHead className="px-4">runId</TableHead>
                      <TableHead className="px-4">Queued at</TableHead>
                      <TableHead className="px-4">Linked status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {queueRows.map((row) => (
                      <TableRow key={row.linkKey}>
                        <TableCell className="px-4 font-medium">
                          {row.extensionName ?? row.queue.id}
                        </TableCell>
                        <TableCell className="px-4 font-mono text-xs">{row.queue.version}</TableCell>
                        <TableCell className="max-w-[10rem] truncate px-4 font-mono text-xs" title={row.queue.runId}>
                          {row.queue.runId}
                        </TableCell>
                        <TableCell className="whitespace-nowrap px-4 text-xs text-muted-foreground">
                          {formatTime(row.queue.incoming_time)}
                        </TableCell>
                        <TableCell className="px-4">
                          <div className="flex flex-wrap items-center gap-2">
                            <LinkedBadge linked={row.status !== null} />
                            {row.status ? agentStatusBadge(row.status.status) : null}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Status</CardTitle>
            <CardDescription>
              Rows from <code className="text-xs">status.json</code> (newest first)
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {loading && statusRows.length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted-foreground">Loading…</p>
            ) : statusRows.length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted-foreground">No status entries yet.</p>
            ) : (
              <div className="max-h-[32rem] overflow-x-auto overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="px-4">Extension</TableHead>
                      <TableHead className="px-4">Version</TableHead>
                      <TableHead className="px-4">Agent</TableHead>
                      <TableHead className="px-4">Analysis</TableHead>
                      <TableHead className="px-4">Updated</TableHead>
                      <TableHead className="px-4">In queue</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {statusRows.map((row) => (
                      <TableRow key={row.linkKey}>
                        <TableCell className="px-4 font-medium">
                          {row.extensionName ?? row.status.id}
                        </TableCell>
                        <TableCell className="px-4 font-mono text-xs">{row.status.version}</TableCell>
                        <TableCell className="px-4">{agentStatusBadge(row.status.status)}</TableCell>
                        <TableCell className="px-4">
                          <div className="space-y-1">
                            {analysisBadge(row.analysisStatus)}
                            {row.analysisError ? (
                              <div className="max-w-[12rem] truncate text-xs text-destructive" title={row.analysisError}>
                                {row.analysisError}
                              </div>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell className="whitespace-nowrap px-4 text-xs text-muted-foreground">
                          {formatTime(row.status.status_time)}
                        </TableCell>
                        <TableCell className="px-4">
                          <LinkedBadge linked={row.inQueue} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <p className="text-xs text-muted-foreground">
        <strong>Linked</strong> means the same extension id, version, and runId (or index) appears in
        both queue and status. Queue entries without a match are waiting for the agent; status rows
        without a match have already left the queue or were created outside the queue file.
      </p>
    </div>
  )
}
