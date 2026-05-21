"use client"

import { useState } from "react"
import type { UIMessage } from "ai"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Spinner } from "@/components/ui/spinner"
import { useToast } from "@/components/ui/use-toast"
import { buildClientInvestigationShareUrl } from "@/lib/issue-share-url"
import { isContextSeedMessage } from "@/lib/issue-chat-messages"
import type { WorkbenchCheckItem } from "@/lib/workbench-check-items"

export function IssueInvestigationShareHeader({ onCancel }: { onCancel: () => void }) {
  return (
    <div className="flex shrink-0 items-center justify-between border-b px-4 py-3">
      <h2 className="text-base font-semibold tracking-tight">Select Messages</h2>
      <Button type="button" variant="ghost" size="sm" className="text-sm" onClick={onCancel}>
        Cancel
      </Button>
    </div>
  )
}

export function IssueInvestigationShareFooter({
  storeId,
  issue,
  messages,
  shareableIds,
  optionalIds,
  selectedIds,
  onSelectedIdsChange,
  onDone,
  disabled,
}: {
  storeId: string
  issue: WorkbenchCheckItem
  messages: UIMessage[]
  shareableIds: string[]
  optionalIds: string[]
  selectedIds: Set<string>
  onSelectedIdsChange: (next: Set<string>) => void
  onDone: () => void
  disabled?: boolean
}) {
  const { toast } = useToast()
  const [creating, setCreating] = useState(false)

  const allOptionalSelected =
    optionalIds.length === 0 || optionalIds.every((id) => selectedIds.has(id))
  const someOptionalSelected = optionalIds.some((id) => selectedIds.has(id))

  const toggleSelectAll = () => {
    if (allOptionalSelected) {
      const next = new Set<string>()
      for (const message of messages) {
        if (isContextSeedMessage(message)) next.add(message.id)
      }
      onSelectedIdsChange(next)
    } else {
      onSelectedIdsChange(new Set(shareableIds))
    }
  }

  const handleCopyLink = async () => {
    const messageIds = shareableIds.filter((id) => selectedIds.has(id))
    if (messageIds.length === 0) {
      toast({ variant: "destructive", description: "Select at least one message to share." })
      return
    }

    setCreating(true)
    try {
      const res = await fetch("/api/issues/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeId,
          issueId: issue.id,
          issue,
          messageIds,
          messages,
        }),
      })
      const json = (await res.json().catch(() => null)) as
        | { shareToken?: string; error?: string }
        | null
      const url = json?.shareToken ? buildClientInvestigationShareUrl(json.shareToken) : ""
      if (!res.ok || !url) {
        toast({
          variant: "destructive",
          description: json?.error ?? "Failed to create share link.",
        })
        return
      }
      await navigator.clipboard.writeText(url)
      toast({ description: "Link copied to clipboard." })
      onDone()
    } catch {
      toast({ variant: "destructive", description: "Failed to create share link." })
    } finally {
      setCreating(false)
    }
  }

  const canCopy = selectedIds.size > 0 && !disabled && !creating

  return (
    <div className="flex shrink-0 items-center justify-between border-t bg-background px-4 py-3">
      <div className="flex items-center gap-2">
        <Checkbox
          id="share-select-all-footer"
          checked={allOptionalSelected ? true : someOptionalSelected ? "indeterminate" : false}
          onCheckedChange={() => toggleSelectAll()}
          disabled={optionalIds.length === 0 || creating || disabled}
        />
        <Label htmlFor="share-select-all-footer" className="cursor-pointer text-sm font-medium">
          Select all
        </Label>
      </div>
      <Button
        type="button"
        size="sm"
        className="min-w-[7.5rem] rounded-full px-5"
        disabled={!canCopy}
        onClick={() => void handleCopyLink()}
      >
        {creating ? <Spinner className="size-4" /> : "Copy Link"}
      </Button>
    </div>
  )
}
