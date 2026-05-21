"use client"

import type { UIMessage } from "ai"
import { isToolUIPart } from "ai"
import { ChevronDownIcon, CodeIcon } from "lucide-react"
import { useState } from "react"
import { cn } from "@/lib/utils"
import type { LocateDomainInSourceResult } from "@/lib/domain-code-locator"
import type { LookupDomainWhoisResult } from "@/lib/domain-whois-lookup"

type ToolPart = Extract<UIMessage["parts"][number], { type: string }>

function formatToolLabel(part: ToolPart): string {
  if (part.type === "dynamic-tool" && "toolName" in part) {
    return String(part.toolName).replace(/_/g, " ")
  }
  if (part.type.startsWith("tool-")) {
    return part.type.slice(5).replace(/_/g, " ")
  }
  return "Tool"
}

function LookupWhoisOutput({ output }: { output: LookupDomainWhoisResult }) {
  if (!output.ok || !output.info) {
    return (
      <p className="text-xs text-muted-foreground">
        WHOIS lookup failed for{" "}
        <span className="font-mono text-foreground">{output.domain}</span>
        {output.error ? `: ${output.error}` : "."}
      </p>
    )
  }

  const { info } = output
  const rows: Array<{ label: string; value: string }> = [
    { label: "Registrar", value: info.registrar ?? "—" },
    {
      label: "Created",
      value: info.createdDate
        ? `${info.createdDate.slice(0, 10)}${info.ageDays != null ? ` (${info.ageDays}d ago)` : ""}`
        : "—",
    },
    { label: "Expires", value: info.expiresDate ? info.expiresDate.slice(0, 10) : "—" },
    {
      label: "Nameservers",
      value: info.nameservers.length ? info.nameservers.slice(0, 4).join(", ") : "—",
    },
  ]

  return (
    <div className="space-y-2 text-xs">
      <p className="text-muted-foreground">
        <span className="font-mono text-foreground">{output.domain}</span>
        {output.tld ? ` · .${output.tld}` : ""} · {output.source}
      </p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
        {rows.map((row) => (
          <div key={row.label} className="contents">
            <dt className="text-muted-foreground">{row.label}</dt>
            <dd className="break-all text-foreground">{row.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

function LocateDomainOutput({ output }: { output: LocateDomainInSourceResult }) {
  if (output.occurrences.length === 0) {
    return (
      <div className="space-y-2 text-xs text-muted-foreground">
        <p>
          No code matches found for{" "}
          <span className="font-mono text-foreground">{output.apexDomain}</span>.
        </p>
        {output.notes.map((note) => (
          <p key={note}>{note}</p>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-3 text-xs">
      <p className="text-muted-foreground">
        {output.occurrences.length} match(es) in {output.scannedFiles.length} file(s)
        {output.extensionVersion ? ` · v${output.extensionVersion}` : ""}
        {" · "}
        compact char snippets
      </p>
      {output.occurrences.map((hit, index) => (
        <div
          key={`${hit.file}-${hit.line}-${hit.column}-${index}`}
          className="overflow-hidden rounded-md border bg-muted/30 font-mono text-[11px] leading-relaxed"
        >
          <div className="border-b bg-muted/50 px-2 py-1 text-[10px] text-muted-foreground">
            {hit.file}:{hit.line}:{hit.column} · {hit.matchedTerm}
          </div>
          <pre className="max-h-32 overflow-auto p-2 whitespace-pre-wrap break-all text-foreground">
            {hit.snippet}
          </pre>
        </div>
      ))}
      {output.notes.length > 0 ? (
        <ul className="list-disc space-y-1 pl-4 text-muted-foreground">
          {output.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

function ToolOutputBody({ part }: { part: ToolPart }) {
  if (!isToolUIPart(part)) return null

  if (part.state === "input-streaming" || part.state === "input-available") {
    const domain =
      part.input && typeof part.input === "object" && "domain" in (part.input as object)
        ? String((part.input as { domain?: string }).domain)
        : ""
    const verb =
      part.type === "tool-lookup_domain_whois"
        ? "Looking up WHOIS"
        : "Searching extension source"
    return (
      <p className="text-xs text-muted-foreground">
        {verb}
        {domain ? ` for ${domain}` : ""}
        …
      </p>
    )
  }

  if (part.state === "output-error") {
    return <p className="text-xs text-destructive">{part.errorText}</p>
  }

  if (part.state !== "output-available" || part.output == null) {
    return null
  }

  if (part.type === "tool-lookup_domain_whois") {
    return <LookupWhoisOutput output={part.output as LookupDomainWhoisResult} />
  }

  if (part.type === "tool-locate_domain_in_source") {
    return <LocateDomainOutput output={part.output as LocateDomainInSourceResult} />
  }

  return (
    <pre className="max-h-48 overflow-auto rounded-md bg-muted/40 p-2 text-[11px] whitespace-pre-wrap">
      {JSON.stringify(part.output, null, 2)}
    </pre>
  )
}

export function IssueChatToolPart({ part }: { part: ToolPart }) {
  const [open, setOpen] = useState(true)
  if (!isToolUIPart(part)) return null

  const busy =
    part.state === "input-streaming" ||
    part.state === "input-available" ||
    part.state === "approval-requested"

  return (
    <div className="my-2 w-full max-w-full rounded-lg border border-dashed border-muted-foreground/25 bg-muted/20">
      <button
        type="button"
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-muted-foreground hover:text-foreground"
        onClick={() => setOpen((value) => !value)}
      >
        <CodeIcon className="size-3.5 shrink-0" />
        <span className="flex-1 capitalize">{formatToolLabel(part)}</span>
        {busy ? <span className="text-[10px]">Running…</span> : null}
        <ChevronDownIcon className={cn("size-3.5 transition-transform", open && "rotate-180")} />
      </button>
      {open ? (
        <div className="border-t px-3 py-2">
          <ToolOutputBody part={part} />
        </div>
      ) : null}
    </div>
  )
}
