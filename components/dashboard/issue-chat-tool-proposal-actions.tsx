"use client"

import { useState } from "react"
import { ListPlusIcon, ShieldOffIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  type AllowlistProposalOutput,
  type DismissProposalOutput,
  dismissalReasonLabel,
} from "@/lib/issue-chat-tool-proposals"

export type IssueChatToolPartActions = {
  storeId: string
  issueId: string
  extensionVersion?: string | null
  findingIsActive: boolean
  onResolutionChange?: () => void
}

type LocalOutcome = "pending" | "applied" | "cancelled"

function ProposalActions({
  canConfirm,
  confirming,
  error,
  outcome,
  onConfirm,
  onCancel,
}: {
  canConfirm: boolean
  confirming: boolean
  error: string
  outcome: LocalOutcome
  onConfirm: () => void
  onCancel: () => void
}) {
  if (outcome === "applied") {
    return <p className="text-xs font-medium text-green-700 dark:text-green-400">Applied.</p>
  }
  if (outcome === "cancelled") {
    return <p className="text-xs text-muted-foreground">Cancelled.</p>
  }
  if (!canConfirm) {
    return (
      <p className="text-xs text-muted-foreground">
        This finding is already resolved; no further action needed.
      </p>
    )
  }

  return (
    <div className="space-y-2">
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" className="h-8 text-xs" disabled={confirming} onClick={onConfirm}>
          {confirming ? "Applying…" : "Confirm"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 text-xs"
          disabled={confirming}
          onClick={onCancel}
        >
          Cancel
        </Button>
      </div>
    </div>
  )
}

export function AllowlistProposalActions({
  output,
  actions,
}: {
  output: AllowlistProposalOutput
  actions?: IssueChatToolPartActions
}) {
  const [outcome, setOutcome] = useState<LocalOutcome>(
    output.status === "cancelled" ? "cancelled" : "pending",
  )
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState("")

  const canConfirm = Boolean(actions?.findingIsActive) && outcome === "pending"

  const handleConfirm = async () => {
    if (!actions?.storeId) return
    setError("")
    setConfirming(true)
    try {
      const res = await fetch(
        `/api/extensions/${encodeURIComponent(actions.storeId)}/allowlist`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            domain: output.domain,
            note: output.note || output.rationale,
          }),
        },
      )
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null
        throw new Error(data?.error || "Could not add domain to allowlist.")
      }
      setOutcome("applied")
      actions.onResolutionChange?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add domain to allowlist.")
    } finally {
      setConfirming(false)
    }
  }

  return (
    <div className="space-y-3 text-xs">
      <div className="flex items-start gap-2">
        <ListPlusIcon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
        <div className="min-w-0 space-y-1">
          <p className="font-medium text-foreground">
            Add <span className="font-mono">{output.domain}</span> to allowlist?
          </p>
          <p className="text-muted-foreground leading-relaxed">{output.rationale}</p>
        </div>
      </div>
      {actions ? (
        <ProposalActions
          canConfirm={canConfirm}
          confirming={confirming}
          error={error}
          outcome={outcome}
          onConfirm={() => void handleConfirm()}
          onCancel={() => setOutcome("cancelled")}
        />
      ) : (
        <p className="text-muted-foreground">Confirmation required in the live investigation view.</p>
      )}
    </div>
  )
}

export function DismissProposalActions({
  output,
  actions,
}: {
  output: DismissProposalOutput
  actions?: IssueChatToolPartActions
}) {
  const [outcome, setOutcome] = useState<LocalOutcome>(
    output.status === "cancelled" ? "cancelled" : "pending",
  )
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState("")

  const canConfirm =
    Boolean(actions?.findingIsActive) &&
    outcome === "pending" &&
    (!actions?.issueId || output.issueId === actions.issueId)

  const handleConfirm = async () => {
    if (!actions?.storeId) return
    setError("")
    setConfirming(true)
    try {
      const res = await fetch(
        `/api/extensions/${encodeURIComponent(actions.storeId)}/findings/dismiss`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            issueId: output.issueId,
            reason: output.reason,
            note: output.note || output.rationale,
            extensionVersion: actions.extensionVersion?.trim() || undefined,
            alsoAllowlistDomain: output.alsoAllowlistDomain,
          }),
        },
      )
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null
        throw new Error(data?.error || "Could not dismiss finding.")
      }
      setOutcome("applied")
      actions.onResolutionChange?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not dismiss finding.")
    } finally {
      setConfirming(false)
    }
  }

  return (
    <div className="space-y-3 text-xs">
      <div className="flex items-start gap-2">
        <ShieldOffIcon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
        <div className="min-w-0 space-y-1">
          <p className="font-medium text-foreground">Mark this finding as false positive?</p>
          <p className="text-muted-foreground">
            Reason: <span className="text-foreground">{dismissalReasonLabel(output.reason)}</span>
          </p>
          <p className="text-muted-foreground leading-relaxed">{output.rationale}</p>
          {output.alsoAllowlistDomain ? (
            <p className="text-muted-foreground">Also adds the related apex domain to the allowlist.</p>
          ) : null}
        </div>
      </div>
      {actions ? (
        <ProposalActions
          canConfirm={canConfirm}
          confirming={confirming}
          error={error}
          outcome={outcome}
          onConfirm={() => void handleConfirm()}
          onCancel={() => setOutcome("cancelled")}
        />
      ) : (
        <p className="text-muted-foreground">Confirmation required in the live investigation view.</p>
      )}
    </div>
  )
}
