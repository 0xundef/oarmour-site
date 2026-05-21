"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { isToolUIPart, type UIMessage } from "ai"
import { Link2Icon, Trash2Icon } from "lucide-react"
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog"
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
import { Spinner } from "@/components/ui/spinner"
import { useToast } from "@/components/ui/use-toast"
import { cn } from "@/lib/utils"
import { isContextSeedMessage } from "@/lib/issue-chat-messages"
import type { WorkbenchCheckItem } from "@/lib/workbench-check-items"

type ActiveShare = {
  shareToken: string
  shareUrl: string
  createdAt: string
}

function messagePreview(message: UIMessage): string {
  if (isContextSeedMessage(message)) return "Finding context"
  const textPart = message.parts.find((p) => p.type === "text" && (p.text ?? "").trim())
  if (textPart && textPart.type === "text") {
    const preview = textPart.text.replace(/\s+/g, " ").trim().slice(0, 72)
    return `${message.role === "assistant" ? "Assistant" : "You"}: ${preview}${textPart.text.length > 72 ? "…" : ""}`
  }
  if (message.parts.some(isToolUIPart)) {
    return `${message.role === "assistant" ? "Assistant" : "You"}: Tool results`
  }
  return `${message.role === "assistant" ? "Assistant" : "You"}: (empty)`
}

function formatShareTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

export function IssueInvestigationShareDialog({
  open,
  onOpenChange,
  storeId,
  issue,
  messages,
  disabled,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  storeId: string
  issue: WorkbenchCheckItem
  messages: UIMessage[]
  disabled?: boolean
}) {
  const { toast } = useToast()
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [creating, setCreating] = useState(false)
  const [loadingShares, setLoadingShares] = useState(false)
  const [activeShares, setActiveShares] = useState<ActiveShare[]>([])
  const [shareUrl, setShareUrl] = useState("")
  const [revokeTarget, setRevokeTarget] = useState<ActiveShare | null>(null)
  const [revoking, setRevoking] = useState(false)

  const selectableMessages = useMemo(() => messages, [messages])
  const shareableIds = useMemo(
    () => selectableMessages.map((message) => message.id),
    [selectableMessages],
  )
  const optionalIds = useMemo(
    () => shareableIds.filter((id) => !id.startsWith("issue-context-")),
    [shareableIds],
  )

  const loadActiveShares = useCallback(async () => {
    setLoadingShares(true)
    try {
      const params = new URLSearchParams({ storeId, issueId: issue.id })
      const res = await fetch(`/api/issues/share?${params.toString()}`, { cache: "no-store" })
      if (!res.ok) {
        setActiveShares([])
        return
      }
      const json = (await res.json()) as { shares?: ActiveShare[] }
      setActiveShares(Array.isArray(json.shares) ? json.shares : [])
    } catch {
      setActiveShares([])
    } finally {
      setLoadingShares(false)
    }
  }, [storeId, issue.id])

  useEffect(() => {
    if (!open) return
    setShareUrl("")
    setRevokeTarget(null)
    setSelectedIds(new Set(shareableIds))
    void loadActiveShares()
  }, [open, shareableIds, loadActiveShares])

  const allOptionalSelected =
    optionalIds.length === 0 || optionalIds.every((id) => selectedIds.has(id))
  const someOptionalSelected = optionalIds.some((id) => selectedIds.has(id))

  const toggleMessage = (id: string, checked: boolean) => {
    const message = selectableMessages.find((m) => m.id === id)
    if (message && isContextSeedMessage(message)) return
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (allOptionalSelected) {
      const next = new Set<string>()
      for (const message of selectableMessages) {
        if (isContextSeedMessage(message)) next.add(message.id)
      }
      setSelectedIds(next)
    } else {
      setSelectedIds(new Set(shareableIds))
    }
  }

  const handleCreate = async () => {
    const messageIds = shareableIds.filter((id) => selectedIds.has(id))
    if (messageIds.length === 0) {
      toast({ variant: "destructive", description: "Select at least the finding context to share." })
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
        | { shareUrl?: string; error?: string }
        | null
      if (!res.ok || !json?.shareUrl) {
        toast({
          variant: "destructive",
          description: json?.error ?? "Failed to create share link.",
        })
        return
      }
      setShareUrl(json.shareUrl)
      await navigator.clipboard.writeText(json.shareUrl)
      toast({ description: "Share link created and copied to clipboard." })
      await loadActiveShares()
    } catch {
      toast({ variant: "destructive", description: "Failed to create share link." })
    } finally {
      setCreating(false)
    }
  }

  const handleCopy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url)
      toast({ description: "Share link copied." })
    } catch {
      toast({ variant: "destructive", description: "Could not copy link. Allow clipboard access." })
    }
  }

  const handleRevoke = async () => {
    if (!revokeTarget) return
    setRevoking(true)
    try {
      const res = await fetch(
        `/api/issues/share/${encodeURIComponent(revokeTarget.shareToken)}`,
        { method: "DELETE" },
      )
      if (!res.ok) {
        toast({ variant: "destructive", description: "Failed to revoke share link." })
        return
      }
      if (shareUrl === revokeTarget.shareUrl) setShareUrl("")
      setRevokeTarget(null)
      toast({ description: "Share link revoked." })
      await loadActiveShares()
    } catch {
      toast({ variant: "destructive", description: "Failed to revoke share link." })
    } finally {
      setRevoking(false)
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex max-h-[85dvh] max-w-lg flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle>Share investigation</DialogTitle>
            <DialogDescription>
              Create a public read-only link. No login required. Revoke any link below to disable
              access immediately.
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto py-1">
            <section className="space-y-2">
              <h3 className="text-sm font-medium">Active share links</h3>
              {loadingShares ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Spinner className="size-3.5" />
                  Loading…
                </div>
              ) : activeShares.length === 0 ? (
                <p className="text-xs text-muted-foreground">No active links for this finding.</p>
              ) : (
                <ul className="space-y-2">
                  {activeShares.map((share) => (
                    <li
                      key={share.shareToken}
                      className="rounded-md border bg-muted/20 px-3 py-2 text-xs"
                    >
                      <p className="text-muted-foreground">{formatShareTime(share.createdAt)}</p>
                      <p className="mt-1 break-all font-mono text-[11px] text-foreground">
                        {share.shareUrl}
                      </p>
                      <div className="mt-2 flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          disabled={creating || revoking}
                          onClick={() => void handleCopy(share.shareUrl)}
                        >
                          Copy
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 gap-1 text-xs text-destructive hover:text-destructive"
                          disabled={creating || revoking}
                          onClick={() => setRevokeTarget(share)}
                        >
                          <Trash2Icon className="size-3" />
                          Revoke
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="space-y-2 border-t pt-3">
              <h3 className="text-sm font-medium">New share</h3>
              <div className="flex items-center gap-2 pb-1">
                <Checkbox
                  id="share-select-all"
                  checked={
                    allOptionalSelected ? true : someOptionalSelected ? "indeterminate" : false
                  }
                  onCheckedChange={() => toggleSelectAll()}
                  disabled={optionalIds.length === 0 || creating}
                />
                <Label htmlFor="share-select-all" className="cursor-pointer text-sm font-medium">
                  Select all messages
                </Label>
              </div>

              <ul className="space-y-2">
                {selectableMessages.map((message) => {
                  const isSeed = isContextSeedMessage(message)
                  const checked = selectedIds.has(message.id)
                  return (
                    <li
                      key={message.id}
                      className="flex items-start gap-2 rounded-md border bg-muted/20 px-3 py-2"
                    >
                      <Checkbox
                        id={`share-msg-${message.id}`}
                        checked={checked}
                        disabled={isSeed || creating}
                        onCheckedChange={(value) => toggleMessage(message.id, value === true)}
                        className="mt-0.5"
                      />
                      <Label
                        htmlFor={`share-msg-${message.id}`}
                        className={cn(
                          "flex-1 cursor-pointer text-xs leading-snug",
                          isSeed && "text-muted-foreground",
                        )}
                      >
                        {messagePreview(message)}
                      </Label>
                    </li>
                  )
                })}
              </ul>

              {shareUrl ? (
                <div className="rounded-md border border-dashed bg-muted/30 p-3 text-xs break-all">
                  <p className="mb-1 text-muted-foreground">Latest created link</p>
                  {shareUrl}
                </div>
              ) : null}
            </section>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              disabled={disabled || creating || selectedIds.size === 0}
              onClick={() => void handleCreate()}
              className="gap-1.5"
            >
              {creating ? <Spinner className="size-4" /> : <Link2Icon className="size-4" />}
              Create & copy link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        open={revokeTarget !== null}
        onOpenChange={(next) => {
          if (!next) setRevokeTarget(null)
        }}
        onConfirm={() => void handleRevoke()}
        title="Revoke share link?"
        description="Anyone with this link will no longer be able to view this shared investigation. This cannot be undone."
        confirmLabel="Revoke"
        loading={revoking}
      />
    </>
  )
}
