"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useToast } from "@/components/ui/use-toast"
import { cn } from "@/lib/utils"

type MonitorExtension = {
  storeId: string
  name: string
  version: string | null
  pendingVersion?: string | null
}

type TaskSession = {
  sessionId: string
  extensionId: string
  extensionName?: string
  version: string
  status: string
  error?: string
  queuedAt?: string
  updatedAt?: string
  duration?: number
  inQueue: boolean
}

function formatTime(iso?: string | null) {
  if (!iso) return "—"
  const d = new Date(iso)
  if (!Number.isFinite(d.getTime())) return "—"
  return d.toLocaleString()
}

function formatDuration(seconds?: number) {
  if (seconds == null || !Number.isFinite(seconds)) return "—"
  if (seconds < 60) return `${seconds}s`
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return s > 0 ? `${m}m ${s}s` : `${m}m`
}

function statusBadge(status: string) {
  switch (status) {
    case "running":
      return <Badge className="bg-blue-600 hover:bg-blue-600">running</Badge>
    case "queued":
      return <Badge variant="secondary">queued</Badge>
    case "pending":
      return <Badge variant="outline">dispatched</Badge>
    case "complete":
      return <Badge className="bg-green-600 hover:bg-green-600">complete</Badge>
    case "cancelled":
      return <Badge variant="secondary">cancelled</Badge>
    case "error":
      return <Badge variant="destructive">error</Badge>
    default:
      return <Badge variant="outline">{status}</Badge>
  }
}

function canCancelTask(status: string) {
  return status === "queued" || status === "running" || status === "pending"
}

export function BrowserAgentDashboard({ extensions }: { extensions: MonitorExtension[] }) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [apiConfigured, setApiConfigured] = useState<boolean | null>(null)
  const [taskSessions, setTaskSessions] = useState<TaskSession[]>([])
  const [taskSource, setTaskSource] = useState<"db" | null>(null)
  const [playwrightRunningCount, setPlaywrightRunningCount] = useState<number | null>(null)
  const [enqueueStoreId, setEnqueueStoreId] = useState(extensions[0]?.storeId ?? "")
  const [selectedTask, setSelectedTask] = useState<TaskSession | null>(null)

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
      const [tasksRes, playwrightRes] = await Promise.all([
        fetch("/api/admin/browser-agent/sessions", { cache: "no-store" }),
        fetch("/api/admin/browser-agent/playwright/sessions", { cache: "no-store" }),
      ])

      if (tasksRes.ok) {
        const json = (await tasksRes.json()) as {
          sessions?: TaskSession[]
          source?: "db"
          apiConfigured?: boolean
        }
        setTaskSessions(json.sessions ?? [])
        setTaskSource(json.source ?? null)
        if (json.apiConfigured !== undefined) setApiConfigured(json.apiConfigured)
      }

      if (playwrightRes.ok) {
        const json = (await playwrightRes.json()) as {
          sessions?: unknown[]
          apiConfigured?: boolean
        }
        setPlaywrightRunningCount(Array.isArray(json.sessions) ? json.sessions.length : 0)
        if (json.apiConfigured !== undefined) setApiConfigured(json.apiConfigured)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
    const interval = setInterval(() => void refresh(), 5000)
    return () => clearInterval(interval)
  }, [refresh])

  useEffect(() => {
    setSelectedTask((prev) => {
      if (!prev) return null
      return taskSessions.find((row) => row.sessionId === prev.sessionId) ?? null
    })
  }, [taskSessions])

  const killAllPlaywright = async (force: boolean) => {
    setBusy(true)
    try {
      const res = await fetch("/api/admin/browser-agent/playwright/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(typeof json?.error === "string" ? json.error : "Kill all failed")
      toast({
        description: force
          ? "Closed all sessions and force-killed daemons."
          : "Closed all playwright-cli sessions.",
      })
      await refresh()
    } catch (e) {
      toast({
        variant: "destructive",
        description: e instanceof Error ? e.message : "Kill all failed",
      })
    } finally {
      setBusy(false)
    }
  }

  const submitTask = async () => {
    if (!selectedExtension || !enqueueVersion) return
    setBusy(true)
    try {
      const res = await fetch("/api/admin/browser-agent/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          extensionId: selectedExtension.storeId,
          name: selectedExtension.name,
          version: enqueueVersion,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(typeof json?.error === "string" ? json.error : "Enqueue failed")
      }
      toast({
        description: `Task queued. sessionId=${typeof json?.sessionId === "string" ? json.sessionId : "—"}`,
      })
      await refresh()
    } catch (e) {
      toast({
        variant: "destructive",
        description: e instanceof Error ? e.message : "Enqueue failed",
      })
    } finally {
      setBusy(false)
    }
  }

  const cancelTask = async (sessionId: string) => {
    setBusy(true)
    try {
      const res = await fetch(
        `/api/admin/browser-agent/sessions/${encodeURIComponent(sessionId)}`,
        { method: "DELETE" },
      )
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(typeof json?.error === "string" ? json.error : "Cancel failed")
      }
      toast({ description: `Cancelled session ${sessionId}.` })
      await refresh()
    } catch (e) {
      toast({
        variant: "destructive",
        description: e instanceof Error ? e.message : "Cancel failed",
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      {apiConfigured === false ? (
        <Card className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30">
          <CardContent className="pt-6 text-sm text-muted-foreground">
            <code className="text-xs">BROWSER_AGENT_API_URL</code> is not set. Tasks are queued in
            the database but will not dispatch until the browser agent API is configured. Close all
            / Kill all also require the agent service (
            <code className="text-xs">npm run dev</code> in pi-agent-browser).
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Submit AI test</CardTitle>
          <CardDescription>
            Returns a <code className="text-xs">sessionId</code> (runId) immediately; the browser
            agent worker runs the task in the background.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-muted/20 p-4">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground" htmlFor="browser-agent-extension">
                Extension
              </label>
              <select
                id="browser-agent-extension"
                className="flex h-9 min-w-[14rem] rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                value={enqueueStoreId}
                onChange={(e) => setEnqueueStoreId(e.target.value)}
                disabled={busy}
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
            <Button disabled={busy || !enqueueVersion} onClick={() => void submitTask()}>
              Submit task
            </Button>
            {taskSource ? (
              <span className="text-xs text-muted-foreground">Tasks via {taskSource}</span>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-muted/20 p-4">
            <div
              className="flex min-w-[3rem] items-center justify-center rounded-md border bg-background px-3 py-2 tabular-nums text-xl font-semibold"
              title="Active playwright-cli browser sessions (playwright-cli list)"
              aria-label={`${playwrightRunningCount ?? "—"} running browsers`}
            >
              {apiConfigured === false
                ? "—"
                : playwrightRunningCount == null
                  ? "…"
                  : playwrightRunningCount}
            </div>
            <div className="min-w-0 flex-1 space-y-0.5">
              <div className="text-sm font-medium">Running browsers</div>
              <div className="text-xs text-muted-foreground">
                From browser agent via <code className="text-[10px]">playwright-cli list</code>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy || apiConfigured === false}
                onClick={() => void killAllPlaywright(false)}
              >
                Close all
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={busy || apiConfigured === false}
                onClick={() => void killAllPlaywright(true)}
              >
                Kill all
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">AI test sessions</CardTitle>
          <CardDescription>
            Queue + status from the browser agent worker. Click a row for details.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {loading && taskSessions.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted-foreground">Loading…</p>
          ) : taskSessions.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted-foreground">No task sessions yet.</p>
          ) : (
            <div className="max-h-[40rem] overflow-x-auto overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="px-4">Extension</TableHead>
                    <TableHead className="px-4">Version</TableHead>
                    <TableHead className="px-4">sessionId</TableHead>
                    <TableHead className="px-4">Status</TableHead>
                    <TableHead className="px-4">Updated</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {taskSessions.map((row) => {
                    const isSelected = selectedTask?.sessionId === row.sessionId
                    return (
                      <TableRow
                        key={row.sessionId}
                        className={cn(
                          "cursor-pointer",
                          isSelected && "bg-accent",
                        )}
                        onClick={() => setSelectedTask(row)}
                      >
                        <TableCell className="px-4 font-medium">
                          {row.extensionName ?? row.extensionId}
                        </TableCell>
                        <TableCell className="px-4 font-mono text-xs">{row.version}</TableCell>
                        <TableCell
                          className="max-w-[12rem] truncate px-4 font-mono text-xs"
                          title={row.sessionId}
                        >
                          {row.sessionId}
                        </TableCell>
                        <TableCell className="px-4">{statusBadge(row.status)}</TableCell>
                        <TableCell className="whitespace-nowrap px-4 text-xs text-muted-foreground">
                          {formatTime(row.updatedAt ?? row.queuedAt)}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Sheet
        open={!!selectedTask}
        onOpenChange={(open) => {
          if (!open) setSelectedTask(null)
        }}
      >
        <SheetContent side="right" className="flex w-full flex-col overflow-y-auto sm:max-w-lg">
          {selectedTask ? (
            <>
              <SheetHeader>
                <SheetTitle className="text-left">
                  {selectedTask.extensionName ?? selectedTask.extensionId}
                </SheetTitle>
                <SheetDescription className="text-left">
                  AI test session · {statusBadge(selectedTask.status)}
                </SheetDescription>
              </SheetHeader>

              <dl className="mt-6 space-y-4 text-sm">
                <div>
                  <dt className="text-xs text-muted-foreground">sessionId (runId)</dt>
                  <dd className="mt-1 break-all font-mono text-xs">{selectedTask.sessionId}</dd>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <dt className="text-xs text-muted-foreground">Version</dt>
                    <dd className="mt-1 font-mono text-xs">{selectedTask.version}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Duration</dt>
                    <dd className="mt-1">{formatDuration(selectedTask.duration)}</dd>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <dt className="text-xs text-muted-foreground">Queued</dt>
                    <dd className="mt-1 text-xs">{formatTime(selectedTask.queuedAt)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Updated</dt>
                    <dd className="mt-1 text-xs">{formatTime(selectedTask.updatedAt)}</dd>
                  </div>
                </div>
              </dl>

              {selectedTask.status === "error" && selectedTask.error?.trim() ? (
                <div className="mt-6 rounded-md border border-destructive/30 bg-destructive/5 p-4">
                  <p className="mb-2 text-xs font-medium text-destructive">Error</p>
                  <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words font-mono text-xs text-destructive">
                    {selectedTask.error.trim()}
                  </pre>
                </div>
              ) : null}

              {selectedTask.status === "cancelled" && selectedTask.error?.trim() ? (
                <div className="mt-6 rounded-md border bg-muted/40 p-4">
                  <p className="mb-2 text-xs font-medium text-muted-foreground">Note</p>
                  <p className="whitespace-pre-wrap text-sm">{selectedTask.error.trim()}</p>
                </div>
              ) : null}

              {selectedTask.status === "complete" ? (
                <div className="mt-6 space-y-3 rounded-md border border-green-600/20 bg-green-600/5 p-4 text-sm">
                  <p className="text-green-800 dark:text-green-200">
                    Task finished successfully. Artifacts are under{" "}
                    <code className="text-xs">extension-data/…/ai_testing/{selectedTask.sessionId}</code>
                    .
                  </p>
                  <Button variant="outline" size="sm" asChild>
                    <Link
                      href={`/dashboard/subscribed/${encodeURIComponent(selectedTask.extensionId)}`}
                    >
                      Open extension workbench
                    </Link>
                  </Button>
                </div>
              ) : null}

              {canCancelTask(selectedTask.status) ? (
                <div className="mt-6">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busy}
                    onClick={() => void cancelTask(selectedTask.sessionId)}
                  >
                    Cancel task
                  </Button>
                </div>
              ) : null}
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  )
}
