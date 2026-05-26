"use client"

import { useMemo, useState } from "react"
import type { AiTestingNetworkLog } from "@/lib/ai-testing-network"
import { normalizeAiTestingImageRelativePath } from "@/lib/ai-testing-asset-path"

type AiTestingRecordingStep = {
  time: string
  thinking: string
  image: string
}

function statusBadgeClass(status: number | null, failed?: boolean) {
  if (failed) return "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200"
  if (status === null) return "bg-muted text-muted-foreground"
  if (status >= 400) return "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200"
  if (status >= 300) return "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200"
  return "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200"
}

function formatNetworkStatus(row: {
  status: number | null
  failed?: boolean
  errorText?: string
}) {
  if (row.failed) return row.errorText ?? "FAILED"
  if (row.status !== null) return String(row.status)
  return "—"
}

function AiTestingNetworkPanel({ network }: { network: AiTestingNetworkLog }) {
  const [query, setQuery] = useState("")
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return network.requests
    return network.requests.filter(
      (r) =>
        r.url.toLowerCase().includes(q) ||
        r.method.toLowerCase().includes(q) ||
        (r.resourceType ?? "").toLowerCase().includes(q) ||
        (r.errorText ?? "").toLowerCase().includes(q) ||
        String(r.status ?? "").includes(q),
    )
  }, [network.requests, query])

  return (
    <div className="mt-6 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm font-medium">Network traffic</div>
        <div className="text-xs text-muted-foreground">
          {network.requestCount} request(s)
          {network.capturedAt ? ` · ${network.capturedAt}` : ""}
          {network.filter ? ` · filter: ${network.filter}` : ""}
          {network.source ? ` · via ${network.source}` : ""}
        </div>
      </div>
      <input
        type="search"
        placeholder="Filter by URL, method, status, or error…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
      />
      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {network.requests.length === 0
            ? "No HTTP(S) requests were captured for this run (chrome-extension:// URLs are excluded). Open a page or flow that generates HTTPS traffic, then call capture_network_traffic again."
            : "No matching requests."}
        </p>
      ) : (
        <div className="max-h-72 overflow-auto rounded-md border">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-muted/80 text-muted-foreground">
              <tr>
                <th className="px-2 py-2 font-medium">Type</th>
                <th className="px-2 py-2 font-medium">Method</th>
                <th className="px-2 py-2 font-medium">Status</th>
                <th className="px-2 py-2 font-medium">URL</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row, idx) => (
                <tr key={`${row.method}-${row.url}-${idx}`} className="border-t align-top">
                  <td className="whitespace-nowrap px-2 py-2 font-mono text-[11px]">
                    {row.resourceType ?? "—"}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 font-mono">{row.method}</td>
                  <td className="max-w-[14rem] whitespace-nowrap px-2 py-2">
                    <span
                      className={`inline-block max-w-full truncate rounded px-1.5 py-0.5 font-mono ${statusBadgeClass(row.status, row.failed)}`}
                      title={row.errorText}
                    >
                      {formatNetworkStatus(row)}
                    </span>
                  </td>
                  <td className="break-all px-2 py-2 font-mono text-[11px] leading-snug">
                    {row.url}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export function AiTestingProcedureContent(props: {
  extensionId: string
  records: AiTestingRecordingStep[]
  loading: boolean
  error: string
  assetBaseUrl?: string
  network?: AiTestingNetworkLog | null
}) {
  const { extensionId, records, loading, error, assetBaseUrl, network } = props

  if (loading) {
    return <div className="py-6 text-sm text-muted-foreground">Loading AI testing record...</div>
  }

  if (error) {
    return <div className="py-6 text-sm text-muted-foreground">{error}</div>
  }

  return (
    <div className="space-y-4">
      {records.map((step, idx) => {
        const imageName = normalizeAiTestingImageRelativePath(step.image)
        const imagePath = assetBaseUrl
          ? `${assetBaseUrl}/${imageName.split("/").map(encodeURIComponent).join("/")}`
          : `/ai_testing/${extensionId}/${imageName}`
        return (
          <div key={`${step.time}-${idx}`} className="rounded-md border p-3">
            <div className="mb-2 text-xs font-medium text-muted-foreground">
              Step {idx + 1} · {step.time}
            </div>
            <div className="mb-3 text-sm leading-relaxed">{step.thinking}</div>
            <img
              src={imagePath}
              alt={`AI testing step ${idx + 1}`}
              className="w-full rounded border object-contain"
              loading="lazy"
            />
          </div>
        )
      })}
      {network ? <AiTestingNetworkPanel network={network} /> : null}
    </div>
  )
}
