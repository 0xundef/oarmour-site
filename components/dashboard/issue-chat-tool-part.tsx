"use client"

import type { UIMessage } from "ai"
import { isToolUIPart } from "ai"
import { ChevronDownIcon, CodeIcon } from "lucide-react"
import { useState } from "react"
import { cn } from "@/lib/utils"
import type { LocateDomainInSourceResult } from "@/lib/domain-code-locator"

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

function LocateDomainOutput({ output }: { output: LocateDomainInSourceResult }) {
  if (output.occurrences.length === 0) {
    return (
      <div className="space-y-2 text-xs text-muted-foreground">
        <p>No code matches found for <span className="font-mono text-foreground">{output.apexDomain}</span>.</p>
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
      </p>
      {output.occurrences.map((hit, index) => (
        <div
          key={`${hit.file}-${hit.line}-${index}`}
          className="overflow-hidden rounded-md border bg-muted/30 font-mono text-[11px] leading-relaxed"
        >
          <div className="border-b bg-muted/50 px-2 py-1 text-[10px] text-muted-foreground">
            {hit.file}:{hit.line}:{hit.column}
          </div>
          <pre className="max-h-48 overflow-auto p-2 whitespace-pre-wrap break-all">
            {hit.before.map((line) => (
              <span key={`b-${line}`} className="text-muted-foreground">
                {line}
                {"\n"}
              </span>
            ))}
            <span className="text-foreground">{hit.lineText}</span>
            {"\n"}
            {hit.after.map((line) => (
              <span key={`a-${line}`} className="text-muted-foreground">
                {line}
                {"\n"}
              </span>
            ))}
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
    return (
      <p className="text-xs text-muted-foreground">
        Searching extension source
        {part.input && typeof part.input === "object" && "domain" in (part.input as object)
          ? ` for ${String((part.input as { domain?: string }).domain)}`
          : ""}
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
