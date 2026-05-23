"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { formatDomainAgeDisplay } from "@/lib/format-domain-age"
import {
  listNovelRuntimeDomainSignals,
  type AiTestingLatestPayload,
} from "@/lib/ai-testing-display"

type AiTestingNovelDomainsProps = {
  payload: AiTestingLatestPayload | null
  loading: boolean
  /** Sheet/detail typography; default matches threat-alerts sheet. */
  size?: "compact" | "detail"
}

function isAbortError(e: unknown): boolean {
  if (!e || typeof e !== "object") return false
  if (!("name" in e)) return false
  return (e as { name?: unknown }).name === "AbortError"
}

function getAgeDaysFromCreateTime(createTime: string | null | undefined): number | null {
  if (!createTime) return null
  const created = new Date(createTime)
  if (isNaN(created.getTime())) return null
  return Math.max(0, Math.floor((Date.now() - created.getTime()) / 86400000))
}

export function AiTestingNovelDomains({
  payload,
  loading,
  size = "compact",
}: AiTestingNovelDomainsProps) {
  const novelRows = useMemo(() => listNovelRuntimeDomainSignals(payload, 10), [payload])
  const [domainAgeDays, setDomainAgeDays] = useState<Record<string, number | null>>({})
  const domainMetaRequestedRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    const domains = novelRows
      .filter((row) => getAgeDaysFromCreateTime(row.createTime) === null)
      .map((row) => row.domain)
    const missing = domains.filter((d) => !domainMetaRequestedRef.current.has(d))
    if (missing.length === 0) return
    for (const d of missing) domainMetaRequestedRef.current.add(d)

    const controller = new AbortController()
    const load = async () => {
      await Promise.all(
        missing.map(async (domain) => {
          try {
            const res = await fetch(`/api/ti/whois?domain=${encodeURIComponent(domain)}`, {
              signal: controller.signal,
            })
            if (!res.ok) {
              setDomainAgeDays((prev) => ({ ...prev, [domain]: null }))
              return
            }
            const json: unknown = await res.json()
            const payloadJson =
              typeof json === "object" && json !== null
                ? (json as { info?: { createTime?: unknown } })
                : null
            const createdRaw = payloadJson?.info?.createTime
            const created =
              typeof createdRaw === "string"
                ? new Date(createdRaw)
                : createdRaw instanceof Date
                  ? createdRaw
                  : null
            const createdDate = created && !isNaN(created.getTime()) ? created : null
            const ageDays = createdDate
              ? Math.max(0, Math.floor((Date.now() - createdDate.getTime()) / 86400000))
              : null
            setDomainAgeDays((prev) => ({ ...prev, [domain]: ageDays }))
          } catch (e) {
            if (isAbortError(e)) return
            setDomainAgeDays((prev) => ({ ...prev, [domain]: null }))
          }
        }),
      )
    }
    load()
    return () => controller.abort()
  }, [novelRows])

  const displayRows = useMemo(
    () =>
      novelRows.flatMap((row) => {
        const signalAgeDays = getAgeDaysFromCreateTime(row.createTime)
        const displayAgeDays = signalAgeDays ?? domainAgeDays[row.domain] ?? null
        if (displayAgeDays === null || displayAgeDays === undefined) return []
        return [{ ...row, displayAgeDays }]
      }),
    [novelRows, domainAgeDays],
  )

  if (loading) {
    return <div className="text-muted-foreground">Loading...</div>
  }
  if (displayRows.length === 0) return null

  const isDetail = size === "detail"

  return (
    <>
      {displayRows.map(({ domain, isMalicious, displayAgeDays }) => {
        const malicious = isMalicious === true
        return (
          <div
            key={domain}
            className={
              isDetail
                ? "grid grid-cols-[1fr_7rem] items-center gap-2"
                : "mb-px grid grid-cols-[1fr_5.5rem] items-center gap-2"
            }
          >
            <div className={`min-w-0 truncate ${isDetail ? "" : ""}`}>+ {domain}</div>
            <div className="flex shrink-0 items-center justify-end gap-2">
              <Badge
                variant="secondary"
                className={
                  isDetail
                    ? "h-8 w-[5.75rem] shrink-0 justify-center whitespace-nowrap px-1 text-xl leading-none"
                    : "h-5 w-[4.75rem] shrink-0 justify-center whitespace-nowrap px-1 text-[10px] leading-none"
                }
              >
                {formatDomainAgeDisplay(displayAgeDays)}
              </Badge>
              <span
                className={`inline-block rounded-full ${isDetail ? "h-5 w-5" : "h-3 w-3"} ${malicious ? "bg-red-500" : "bg-green-500"}`}
                title={malicious ? "Malicious" : "Safe"}
              />
            </div>
          </div>
        )
      })}
    </>
  )
}
