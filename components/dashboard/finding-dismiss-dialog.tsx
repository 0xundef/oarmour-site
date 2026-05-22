"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { FINDING_DISMISSAL_REASONS } from "@/lib/finding-resolution"
import type { WorkbenchCheckItem } from "@/lib/workbench-check-items"

export function FindingDismissDialog({
  open,
  onOpenChange,
  storeId,
  issue,
  extensionVersion,
  allowlistDomain,
  onDismissed,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  storeId: string
  issue: WorkbenchCheckItem
  extensionVersion?: string | null
  allowlistDomain: string | null
  onDismissed: () => void
}) {
  const [reason, setReason] = useState<string>(FINDING_DISMISSAL_REASONS[0].value)
  const [note, setNote] = useState("")
  const [alsoAllowlist, setAlsoAllowlist] = useState(Boolean(allowlistDomain))
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async () => {
    setError("")
    setSubmitting(true)
    try {
      const res = await fetch(
        `/api/extensions/${encodeURIComponent(storeId)}/findings/dismiss`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            issueId: issue.id,
            reason,
            note: note.trim() || undefined,
            extensionVersion: extensionVersion?.trim() || undefined,
            alsoAllowlistDomain: allowlistDomain ? alsoAllowlist : false,
          }),
        },
      )
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null
        throw new Error(data?.error || "Could not dismiss finding.")
      }
      onOpenChange(false)
      onDismissed()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not dismiss finding.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Mark as false positive</DialogTitle>
          <DialogDescription>
            This closes the finding for you and moves it to Closed. Open finding counts will decrease.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="space-y-2">
            <Label htmlFor="dismiss-reason">Reason</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger id="dismiss-reason">
                <SelectValue placeholder="Select a reason" />
              </SelectTrigger>
              <SelectContent>
                {FINDING_DISMISSAL_REASONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="dismiss-note">Note (optional)</Label>
            <Textarea
              id="dismiss-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Context for your team or future you…"
              rows={3}
            />
          </div>

          {allowlistDomain ? (
            <div className="flex items-start gap-2 rounded-md border bg-muted/30 p-3">
              <Checkbox
                id="dismiss-allowlist"
                checked={alsoAllowlist}
                onCheckedChange={(v) => setAlsoAllowlist(v === true)}
              />
              <div className="space-y-1">
                <Label htmlFor="dismiss-allowlist" className="cursor-pointer font-medium">
                  Also add {allowlistDomain} to allowlist
                </Label>
                <p className="text-xs text-muted-foreground">
                  Future malicious-domain findings for this apex on this extension will be suppressed for all
                  subscribers.
                </p>
              </div>
            </div>
          ) : null}

          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void handleSubmit()} disabled={submitting}>
            {submitting ? "Saving…" : "Dismiss finding"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
