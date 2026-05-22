"use client"

import { useCallback, useEffect, useState } from "react"
import { Trash2Icon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Spinner } from "@/components/ui/spinner"

type AllowlistEntry = { domain: string; note: string | null; createdAt: string }

export function ExtensionDomainAllowlistSheet({
  storeId,
  onChanged,
}: {
  storeId: string
  onChanged: () => void
}) {
  const [open, setOpen] = useState(false)
  const [entries, setEntries] = useState<AllowlistEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [domain, setDomain] = useState("")
  const [note, setNote] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const res = await fetch(`/api/extensions/${encodeURIComponent(storeId)}/allowlist`, {
        cache: "no-store",
      })
      if (!res.ok) throw new Error("Failed to load allowlist")
      const data = (await res.json()) as { entries?: AllowlistEntry[] }
      setEntries(Array.isArray(data.entries) ? data.entries : [])
    } catch {
      setError("Could not load allowlist.")
      setEntries([])
    } finally {
      setLoading(false)
    }
  }, [storeId])

  useEffect(() => {
    if (open) void load()
  }, [open, load])

  const addDomain = async () => {
    const trimmed = domain.trim()
    if (!trimmed) return
    setSaving(true)
    setError("")
    try {
      const res = await fetch(`/api/extensions/${encodeURIComponent(storeId)}/allowlist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: trimmed, note: note.trim() || undefined }),
      })
      if (!res.ok) throw new Error("Failed to add domain")
      setDomain("")
      setNote("")
      await load()
      onChanged()
    } catch {
      setError("Could not add domain.")
    } finally {
      setSaving(false)
    }
  }

  const removeDomain = async (entryDomain: string) => {
    setError("")
    try {
      const qs = new URLSearchParams({ domain: entryDomain })
      const res = await fetch(
        `/api/extensions/${encodeURIComponent(storeId)}/allowlist?${qs.toString()}`,
        { method: "DELETE" },
      )
      if (!res.ok) throw new Error("Failed to remove")
      await load()
      onChanged()
    } catch {
      setError("Could not remove domain.")
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="h-7 text-xs">
          Allowlist
        </Button>
      </SheetTrigger>
      <SheetContent className="flex w-full flex-col sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Domain allowlist</SheetTitle>
          <SheetDescription>
            Apex domains on this list will not generate malicious-domain findings for this extension.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-3">
          <div className="space-y-2">
            <Label htmlFor="allowlist-domain">Domain</Label>
            <Input
              id="allowlist-domain"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="example.com"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="allowlist-note">Note (optional)</Label>
            <Input
              id="allowlist-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Why this domain is trusted"
            />
          </div>
          <Button type="button" size="sm" disabled={saving || !domain.trim()} onClick={() => void addDomain()}>
            {saving ? "Adding…" : "Add domain"}
          </Button>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>

        <div className="mt-6 min-h-0 flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Spinner className="size-4" />
              Loading…
            </div>
          ) : entries.length === 0 ? (
            <p className="text-sm text-muted-foreground">No allowlisted domains yet.</p>
          ) : (
            <ul className="space-y-2">
              {entries.map((entry) => (
                <li
                  key={entry.domain}
                  className="flex items-start justify-between gap-2 rounded-md border px-3 py-2 text-sm"
                >
                  <div className="min-w-0">
                    <div className="font-medium">{entry.domain}</div>
                    {entry.note ? (
                      <div className="text-xs text-muted-foreground">{entry.note}</div>
                    ) : null}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
                    aria-label={`Remove ${entry.domain}`}
                    onClick={() => void removeDomain(entry.domain)}
                  >
                    <Trash2Icon className="size-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
