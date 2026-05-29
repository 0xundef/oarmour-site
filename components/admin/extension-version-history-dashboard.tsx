"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/components/ui/use-toast"

export type VersionHistoryExtension = {
  id: string
  name: string
  storeId: string
}

type PublisherRelease = {
  version: string
  publishedAt: string
  extensionName: string | null
}

function formatPublishedAt(iso: string) {
  const date = new Date(iso)
  if (!Number.isFinite(date.getTime())) return "—"
  return date.toLocaleString()
}

function formatExtensionOptionLabel(name: string, releaseCount?: number) {
  if (releaseCount == null) return name
  return `${name} (${releaseCount})`
}

export function ExtensionVersionHistoryDashboard({
  extensions,
}: {
  extensions: VersionHistoryExtension[]
}) {
  const { toast } = useToast()
  const [extensionId, setExtensionId] = useState(extensions[0]?.id ?? "")
  const [loading, setLoading] = useState(false)
  const [releases, setReleases] = useState<PublisherRelease[]>([])
  const [releaseCountByExtensionId, setReleaseCountByExtensionId] = useState<
    Record<string, number>
  >({})

  const selected = useMemo(
    () => extensions.find((e) => e.id === extensionId),
    [extensions, extensionId],
  )

  const loadReleases = useCallback(async () => {
    if (!extensionId) {
      setReleases([])
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/extensions/${encodeURIComponent(extensionId)}/publisher-versions`, {
        cache: "no-store",
      })
      const json = (await res.json().catch(() => ({}))) as {
        releases?: PublisherRelease[]
        error?: string
      }
      if (!res.ok) {
        throw new Error(json.error ?? `Failed to load (${res.status})`)
      }
      setReleases(json.releases ?? [])
    } catch (e) {
      setReleases([])
      toast({
        variant: "destructive",
        description: e instanceof Error ? e.message : "Failed to load version history",
      })
    } finally {
      setLoading(false)
    }
  }, [extensionId, toast])

  useEffect(() => {
    void loadReleases()
  }, [loadReleases])

  useEffect(() => {
    let cancelled = false
    const loadReleaseCounts = async () => {
      const entries = await Promise.all(
        extensions.map(async (ext) => {
          try {
            const res = await fetch(
              `/api/admin/extensions/${encodeURIComponent(ext.id)}/publisher-versions`,
              { cache: "no-store" },
            )
            if (!res.ok) return [ext.id, 0] as const
            const json = (await res.json()) as { releases?: unknown[] }
            return [ext.id, Array.isArray(json.releases) ? json.releases.length : 0] as const
          } catch {
            return [ext.id, 0] as const
          }
        }),
      )
      if (cancelled) return
      const next: Record<string, number> = {}
      for (const [id, count] of entries) {
        next[id] = count
      }
      setReleaseCountByExtensionId(next)
    }
    void loadReleaseCounts()
    return () => {
      cancelled = true
    }
  }, [extensions])

  if (extensions.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-sm text-muted-foreground">
          No extensions in the catalog yet.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Version history</CardTitle>
          <CardDescription>
            Publisher versions recorded when extension monitoring detects a new release (
            <code className="text-xs">ExtensionPublisherVersion</code>).
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground" htmlFor="version-history-extension">
              Extension
            </label>
            <Select
              value={extensionId || undefined}
              onValueChange={setExtensionId}
              disabled={loading}
            >
              <SelectTrigger id="version-history-extension" className="min-w-[16rem] w-full">
                <SelectValue placeholder="Select extension" />
              </SelectTrigger>
              <SelectContent>
                {extensions.map((ext) => (
                  <SelectItem key={ext.id} value={ext.id}>
                    {formatExtensionOptionLabel(ext.name, releaseCountByExtensionId[ext.id])}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {selected ? (
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Store ID</div>
              <div className="font-mono text-xs">{selected.storeId}</div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Recorded versions</CardTitle>
          <CardDescription>
            {loading
              ? "Loading…"
              : releases.length === 0
                ? "No publisher versions recorded for this extension yet."
                : `${releases.length} version(s), newest first.`}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40%]">Version</TableHead>
                <TableHead>Updated at</TableHead>
                <TableHead className="hidden sm:table-cell">Name at discovery</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!loading && releases.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="py-8 text-center text-sm text-muted-foreground">
                    No rows yet. Enable monitoring and wait for a version change to be detected.
                  </TableCell>
                </TableRow>
              ) : (
                releases.map((row) => (
                  <TableRow key={`${row.version}-${row.publishedAt}`}>
                    <TableCell className="font-mono text-sm">{row.version}</TableCell>
                    <TableCell className="text-sm">{formatPublishedAt(row.publishedAt)}</TableCell>
                    <TableCell className="hidden text-sm text-muted-foreground sm:table-cell">
                      {row.extensionName?.trim() || "—"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
