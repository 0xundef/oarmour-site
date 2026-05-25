"use client"

import { useState } from "react"
import { ListPlusIcon, ShieldOffIcon, XIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/use-toast"
import type { WorkbenchCheckItem } from "@/lib/workbench-check-items"

type Props = {
  storeId: string
  issue: WorkbenchCheckItem
  extensionVersion?: string | null
  allowlistDomain: string | null
  disabled?: boolean
  onCancel?: () => void
  onResolutionChange: () => void
  onOpenDismissDialog?: () => void
  className?: string
}

export function IssueInvestigationResolutionActions({
  storeId,
  issue,
  extensionVersion,
  allowlistDomain,
  disabled,
  onCancel,
  onResolutionChange,
  onOpenDismissDialog,
  className,
}: Props) {
  const { toast } = useToast()
  const [busy, setBusy] = useState(false)

  const runDismiss = async (alsoAllowlistDomain: boolean) => {
    setBusy(true)
    try {
      const res = await fetch(
        `/api/extensions/${encodeURIComponent(storeId)}/findings/dismiss`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            issueId: issue.id,
            reason: "LEGITIMATE_BUSINESS",
            note: "Confirmed from investigation actions",
            extensionVersion: extensionVersion?.trim() || undefined,
            alsoAllowlistDomain,
          }),
        },
      )
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null
        throw new Error(data?.error || "Could not dismiss finding.")
      }
      toast({ description: alsoAllowlistDomain ? "Dismissed and allowlisted." : "Marked as false positive." })
      onResolutionChange()
    } catch (e) {
      toast({
        variant: "destructive",
        description: e instanceof Error ? e.message : "Could not dismiss finding.",
      })
    } finally {
      setBusy(false)
    }
  }

  const runAllowlist = async () => {
    if (!allowlistDomain) return
    setBusy(true)
    try {
      const res = await fetch(
        `/api/extensions/${encodeURIComponent(storeId)}/allowlist`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            domain: allowlistDomain,
            note: "Added from investigation actions",
          }),
        },
      )
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null
        throw new Error(data?.error || "Could not add to allowlist.")
      }
      toast({ description: `${allowlistDomain} added to allowlist.` })
      onResolutionChange()
    } catch (e) {
      toast({
        variant: "destructive",
        description: e instanceof Error ? e.message : "Could not add to allowlist.",
      })
    } finally {
      setBusy(false)
    }
  }

  const isDisabled = disabled || busy

  return (
    <div
      className={
        className ??
        "rounded-lg border border-primary/20 bg-primary/5 px-3 py-3 space-y-2"
      }
    >
      <p className="text-xs font-medium text-foreground">Choose an action</p>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          className="h-8 gap-1.5 text-xs"
          disabled={isDisabled}
          onClick={() => void runDismiss(false)}
        >
          <ShieldOffIcon className="size-3.5" />
          Mark false positive
        </Button>
        {allowlistDomain ? (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="h-8 gap-1.5 text-xs"
            disabled={isDisabled}
            onClick={() => void runAllowlist()}
          >
            <ListPlusIcon className="size-3.5" />
            Add {allowlistDomain} to allowlist
          </Button>
        ) : null}
        {allowlistDomain ? (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="h-8 text-xs"
            disabled={isDisabled}
            onClick={() => void runDismiss(true)}
          >
            Dismiss + allowlist
          </Button>
        ) : null}
        {onOpenDismissDialog ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 text-xs"
            disabled={isDisabled}
            onClick={onOpenDismissDialog}
          >
            More options…
          </Button>
        ) : null}
        {onCancel ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-8 gap-1 text-xs text-muted-foreground"
            disabled={isDisabled}
            onClick={onCancel}
          >
            <XIcon className="size-3.5" />
            Cancel
          </Button>
        ) : null}
      </div>
    </div>
  )
}
