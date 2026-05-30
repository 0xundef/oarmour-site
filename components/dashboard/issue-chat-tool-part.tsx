"use client"

import type { UIMessage } from "ai"
import { isToolUIPart } from "ai"
import { ChevronDownIcon, CodeIcon } from "lucide-react"
import { useState } from "react"
import { cn } from "@/lib/utils"
import type { LocateDomainInSourceResult } from "@/lib/domain-code-locator"
import type { LookupDomainWhoisResult } from "@/lib/domain-whois-lookup"
import type { FetchWebPageResult } from "@/lib/web-page-fetch"
import type { ExtensionInvestigationFsResult } from "@/lib/extension-investigation-fs"
import type {
  AllowlistProposalOutput,
  DismissProposalOutput,
} from "@/lib/issue-chat-tool-proposals"
import {
  AllowlistProposalActions,
  DismissProposalActions,
  type IssueChatToolPartActions,
} from "@/components/dashboard/issue-chat-tool-proposal-actions"

export type { IssueChatToolPartActions }

type ToolPart = Extract<UIMessage["parts"][number], { type: string }>

function formatToolLabel(part: ToolPart): string {
  if (part.type === "tool-propose_add_allowlist") return "Add to allowlist"
  if (part.type === "tool-propose_dismiss_finding") return "Mark false positive"
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

function FetchWebPageOutput({ output }: { output: FetchWebPageResult }) {
  if (!output.ok) {
    return (
      <p className="text-xs text-muted-foreground">
        Fetch failed for{" "}
        <span className="font-mono text-foreground break-all">{output.url}</span>
        {output.error ? `: ${output.error}` : "."}
      </p>
    )
  }

  return (
    <div className="space-y-2 text-xs">
      <p className="text-muted-foreground break-all">
        <span className="font-mono text-foreground">{output.finalUrl ?? output.url}</span>
        {output.status != null ? ` · HTTP ${output.status}` : ""}
        {output.contentType ? ` · ${output.contentType.split(";")[0]}` : ""}
      </p>
      {output.title ? <p className="font-medium text-foreground">{output.title}</p> : null}
      {output.excerpt ? (
        <pre className="max-h-48 overflow-auto rounded-md bg-muted/40 p-2 whitespace-pre-wrap break-words text-[11px] text-foreground">
          {output.excerpt}
        </pre>
      ) : null}
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

function ExtensionFsOutput({ output }: { output: ExtensionInvestigationFsResult }) {
  if (!output.ok) {
    return (
      <p className="text-xs text-muted-foreground">
        {output.error ?? "Filesystem tool failed."}
      </p>
    )
  }

  return (
    <div className="space-y-2 text-xs">
      <pre className="max-h-64 overflow-auto rounded-md bg-muted/40 p-2 whitespace-pre-wrap break-all font-mono text-[11px] text-foreground">
        {output.text}
      </pre>
      {output.notices?.map((notice) => (
        <p key={notice} className="text-muted-foreground">
          {notice}
        </p>
      ))}
    </div>
  )
}

function ToolOutputBody({
  part,
  actions,
}: {
  part: ToolPart
  actions?: IssueChatToolPartActions
}) {
  if (!isToolUIPart(part)) return null

  if (part.state === "input-streaming" || part.state === "input-available") {
    const input =
      part.input && typeof part.input === "object" ? (part.input as Record<string, unknown>) : null
    const domain = input?.domain != null ? String(input.domain) : ""
    const url = input?.url != null ? String(input.url) : ""
    let verb = "Running tool"
    if (part.type === "tool-lookup_domain_whois") verb = "Looking up WHOIS"
    else if (part.type === "tool-locate_domain_in_source") verb = "Searching extension source"
    else if (part.type === "tool-fetch_web_page") verb = "Fetching page"
    else if (part.type === "tool-ai_testing_trace") verb = "Loading AI test network trace"
    else if (part.type === "tool-base64_codec") verb = "Running base64 codec"
    else if (part.type === "tool-gzip_decode") verb = "Decoding gzip payload"
    else if (part.type === "tool-grep") verb = "Searching extension source"
    else if (part.type === "tool-find") verb = "Finding extension files"
    else if (part.type === "tool-ls") verb = "Listing extension directory"
    else if (part.type === "tool-propose_add_allowlist") verb = "Preparing allowlist suggestion"
    else if (part.type === "tool-propose_dismiss_finding") verb = "Preparing false positive suggestion"
    return (
      <p className="text-xs text-muted-foreground">
        {verb}
        {domain ? ` for ${domain}` : ""}
        {url ? ` ${url}` : ""}
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

  if (part.type === "tool-fetch_web_page") {
    return <FetchWebPageOutput output={part.output as FetchWebPageResult} />
  }

  if (
    part.type === "tool-grep" ||
    part.type === "tool-find" ||
    part.type === "tool-ls"
  ) {
    return <ExtensionFsOutput output={part.output as ExtensionInvestigationFsResult} />
  }

  if (part.type === "tool-propose_add_allowlist") {
    const output = part.output as AllowlistProposalOutput
    if (output.kind === "allowlist_proposal") {
      return <AllowlistProposalActions output={output} actions={actions} />
    }
  }

  if (part.type === "tool-propose_dismiss_finding") {
    const output = part.output as DismissProposalOutput
    if (output.kind === "dismiss_proposal") {
      return <DismissProposalActions output={output} actions={actions} />
    }
  }

  return (
    <pre className="max-h-48 overflow-auto rounded-md bg-muted/40 p-2 text-[11px] whitespace-pre-wrap">
      {JSON.stringify(part.output, null, 2)}
    </pre>
  )
}

export function IssueChatToolPart({
  part,
  actions,
}: {
  part: ToolPart
  actions?: IssueChatToolPartActions
}) {
  const [open, setOpen] = useState(true)
  if (!isToolUIPart(part)) return null

  const isProposal =
    part.type === "tool-propose_add_allowlist" || part.type === "tool-propose_dismiss_finding"

  const busy =
    part.state === "input-streaming" ||
    part.state === "input-available" ||
    part.state === "approval-requested"

  return (
    <div
      className={cn(
        "my-2 w-full max-w-full rounded-lg border bg-muted/20",
        isProposal ? "border-primary/30 border-solid" : "border-dashed border-muted-foreground/25",
      )}
    >
      <button
        type="button"
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-muted-foreground hover:text-foreground"
        onClick={() => setOpen((value) => !value)}
      >
        <CodeIcon className="size-3.5 shrink-0" />
        <span className="flex-1">{formatToolLabel(part)}</span>
        {busy ? <span className="text-[10px]">Running…</span> : null}
        <ChevronDownIcon className={cn("size-3.5 transition-transform", open && "rotate-180")} />
      </button>
      {open ? (
        <div className="border-t px-3 py-2">
          <ToolOutputBody part={part} actions={actions} />
        </div>
      ) : null}
    </div>
  )
}
