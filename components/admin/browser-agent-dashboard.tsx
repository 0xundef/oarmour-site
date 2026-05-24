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
import { useToast } from "@/components/ui/use-toast"

type MonitorExtension = {
  storeId: string
  name: string
  version: string | null
  pendingVersion?: string | null
}

type PlaywrightSession = {
  name: string
  [key: string]: unknown
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

export function BrowserAgentDashboard({ extensions }: { extensions: MonitorExtension[] }) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [apiConfigured, setApiConfigured] = useState<boolean | null>(null)
  const [playwrightSessions, setPlaywrightSessions] = useState<PlaywrightSession[]>([])
  const [taskSessions, setTaskSessions] = useState<TaskSession[]>([])
  const [taskSource, setTaskSource] = useState<"db" | null>(null)
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
      const [playwrightRes, tasksRes] = await Promise.all([
        fetch("/api/admin/browser-agent/playwright/sessions", { cache: "no-store" }),
        fetch("/api/admin/browser-agent/sessions", { cache: "no-store" }),
      ])

      if (playwrightRes.ok) {
        const json = (await playwrightRes.json()) as {
          sessions?: PlaywrightSession[]
          apiConfigured?: boolean
        }
        setPlaywrightSessions(json.sessions ?? [])
        setApiConfigured(json.apiConfigured ?? false)
      }

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
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
    const interval = setInterval(() => void refresh(), 5000)
    return () => clearInterval(interval)
  }, [refresh])

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

  const closePlaywrightSession = async (name: string) => {
    setBusy(true)
    try {
      const res = await fetch(
        `/api/admin/browser-agent/playwright/sessions/${encodeURIComponent(name)}`,
        { method: "DELETE" },
      )
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(typeof json?.error === "string" ? json.error : "Close failed")
      toast({ description: `Closed playwright session "${name}".` })
      await refresh()
    } catch (e) {
      toast({
        variant: "destructive",
        description: e instanceof Error ? e.message : "Close failed",
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
            the database but will not dispatch until the browser agent API is configured. Playwright
            session controls also require the agent service (
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
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground" htmlFor="browser-agent-extension">
              Extension
            </label>
            <select
              id="browser-agent-extension"
              className="flex h-9 min-w-[14rem] rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
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
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle className="text-base">Playwright CLI sessions</CardTitle>
                <CardDescription>Live browser contexts managed by playwright-cli</CardDescription>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy || apiConfigured === false}
                  onClick={() => void killAllPlaywright(false)}
                >
                  Close all
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={busy || apiConfigured === false}
                  onClick={() => void killAllPlaywright(true)}
                >
                  Kill all
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading && playwrightSessions.length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted-foreground">Loading…</p>
            ) : playwrightSessions.length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted-foreground">No playwright-cli sessions.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="px-4">Name</TableHead>
                    <TableHead className="px-4 text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {playwrightSessions.map((row) => (
                    <TableRow key={row.name}>
                      <TableCell className="px-4 font-mono text-sm">{row.name}</TableCell>
                      <TableCell className="px-4 text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={busy}
                          onClick={() => void closePlaywrightSession(row.name)}
                        >
                          Close
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">AI test sessions</CardTitle>
            <CardDescription>Queue + status from the browser agent worker</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {loading && taskSessions.length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted-foreground">Loading…</p>
            ) : taskSessions.length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted-foreground">No task sessions yet.</p>
            ) : (
              <div className="max-h-[32rem] overflow-x-auto overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="px-4">Extension</TableHead>
                      <TableHead className="px-4">Version</TableHead>
                      <TableHead className="px-4">sessionId</TableHead>
                      <TableHead className="px-4">Status</TableHead>
                      <TableHead className="px-4">Updated</TableHead>
                      <TableHead className="px-4 text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {taskSessions.map((row) => (
                      <TableRow key={row.sessionId}>
                        <TableCell className="px-4 font-medium">
                          {row.extensionName ?? row.extensionId}
                        </TableCell>
                        <TableCell className="px-4 font-mono text-xs">{row.version}</TableCell>
                        <TableCell
                          className="max-w-[10rem] truncate px-4 font-mono text-xs"
                          title={row.sessionId}
                        >
                          {row.sessionId}
                        </TableCell>
                        <TableCell className="px-4">{statusBadge(row.status)}</TableCell>
                        <TableCell className="whitespace-nowrap px-4 text-xs text-muted-foreground">
                          {formatTime(row.updatedAt ?? row.queuedAt)}
                        </TableCell>
                        <TableCell className="px-4 text-right">
                          {row.status === "queued" || row.status === "running" ? (
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={busy}
                              onClick={() => void cancelTask(row.sessionId)}
                            >
                              Cancel
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
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
    </div>
  )
}
