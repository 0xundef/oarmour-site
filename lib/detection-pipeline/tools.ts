import "server-only"

import crypto from "crypto"
import fs from "fs"
import path from "path"
import { tool, createSdkMcpServer } from "@anthropic-ai/claude-agent-sdk"
import { z } from "zod"
import { readAiTestingNetworkTrace } from "@/lib/ai-testing-trace-read"
import { runBase64Codec, runGzipDecode } from "@/lib/binary-payload-codec"
import { lookupDomainWhois } from "@/lib/domain-whois-lookup"
import { fetchWebPage } from "@/lib/web-page-fetch"
import { logError } from "@/lib/app-logger"
import {
  FindingInputSchema,
  STAGE_PAYLOAD_SCHEMAS,
  type StageName,
} from "./schemas"
import {
  getFindingsPartitionPath,
  getPipelineStagePath,
} from "./storage"

export interface PipelineToolContext {
  storeId: string
  version: string
  runId?: string
  runDir: string
}

function asResult(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
    structuredContent: data as Record<string, unknown>,
  }
}

function errorResult(message: string) {
  return {
    content: [{ type: "text" as const, text: message }],
    isError: true as const,
  }
}

function anchorHash(file: string, anchor: string) {
  return crypto.createHash("sha1").update(`${file}:${anchor}`).digest("hex").slice(0, 8)
}

function buildCommitTool(ctx: PipelineToolContext) {
  return tool(
    "commit_stage_output",
    "Commit this stage's structured output. Your FINAL action must be calling this tool. "
      + "`stage` is one of recon|findings|dedupe|report. `payload` must match the shape described "
      + "in the stage SOP. On success the tool writes the JSON artifact; on schema failure it "
      + "returns isError with the validation message — fix the payload and retry.",
    {
      stage: z.enum(["recon", "findings", "dedupe", "report"]),
      payload: z.record(z.string(), z.unknown()),
    },
    async (args) => {
      const stage = args.stage as StageName
      const schema = STAGE_PAYLOAD_SCHEMAS[stage]
      const parsed = schema.safeParse(args.payload)
      if (!parsed.success) {
        return errorResult(
          `Schema validation failed for stage "${stage}":\n${parsed.error.message}`,
        )
      }
      try {
        if (stage === "findings") {
          // Assign findingId per finding (anchorHash from file+anchor), write per-partition file.
          const file = parsed.data as {
            partitionId: string
            sourceFidelity: string
            findings: Array<z.infer<typeof FindingInputSchema>>
            notes?: string
          }
          const enriched = {
            ...file,
            findings: file.findings.map((f) => {
              const ev = f.evidence[0]
              return {
                ...f,
                findingId: `dp:${ctx.storeId}:${f.signalClass}:${anchorHash(ev.file, ev.anchor)}`,
              }
            }),
          }
          const outPath = getFindingsPartitionPath(ctx.runDir, file.partitionId)
          fs.writeFileSync(outPath, JSON.stringify(enriched, null, 2), "utf-8")
          return asResult({
            ok: true,
            stage,
            file: path.relative(ctx.runDir, outPath),
            findingsCount: enriched.findings.length,
          })
        }

        const outPath = getPipelineStagePath(ctx.runDir, stage)
        fs.writeFileSync(outPath, JSON.stringify(parsed.data, null, 2), "utf-8")
        return asResult({
          ok: true,
          stage,
          file: path.relative(ctx.runDir, outPath),
        })
      } catch (err) {
        logError("[detection-pipeline] commit_stage_output write failed", {
          stage,
          error: err instanceof Error ? err.message : String(err),
        })
        return errorResult(
          `Failed to write stage output: ${err instanceof Error ? err.message : String(err)}`,
        )
      }
    },
    { annotations: { readOnlyHint: false } },
  )
}

/**
 * Build the in-process `oarmour` MCP server exposed to every pipeline stage.
 * Five read-only investigation tools (reusing existing implementations) +
 * `commit_stage_output` (the only structured-output exit, schema-validated).
 */
export function createOarmourMcpServer(ctx: PipelineToolContext) {
  const lookupDomainWhoisTool = tool(
    "lookup_domain_whois",
    "Look up domain registration signals (RDAP with WHOIS fallback): registrar, "
      + "creation/expiry dates, nameservers, domain age in days. For reputation checks "
      + "on a suspicious destination domain (classes B/C/F/G).",
    { domain: z.string().min(3).describe("Apex domain or hostname, e.g. evil-analytics.com") },
    async (args) => {
      try {
        return asResult(await lookupDomainWhois(args.domain))
      } catch (err) {
        return errorResult(`whois lookup failed: ${err instanceof Error ? err.message : String(err)}`)
      }
    },
    { annotations: { readOnlyHint: true } },
  )

  const fetchWebPageTool = tool(
    "fetch_web_page",
    "Fetch a public HTTPS page and return its title + plain-text excerpt. For vendor "
      + "docs, reputation pages, blocklists, remote payload inspection (classes C/G).",
    { url: z.string().url().describe("Full HTTPS URL, e.g. https://example.com/path") },
    async (args) => {
      try {
        return asResult(await fetchWebPage(args.url))
      } catch (err) {
        return errorResult(`fetch_web_page failed: ${err instanceof Error ? err.message : String(err)}`)
      }
    },
    { annotations: { readOnlyHint: true } },
  )

  const aiTestingTraceTool = tool(
    "ai_testing_trace",
    "Read browser AI-test network traffic for this extension version: prefers "
      + "ai_testing/<runId>/network.json (POST requestBody included when captured). "
      + "Filter by urlContains to investigate a specific host. Confirms runtime exfiltration "
      + "(classes B/F) or remote-code fetches (C).",
    {
      runId: z.string().optional().describe("ai_testing session id; default latest run with recordings.json"),
      urlContains: z.string().optional().describe("Substring filter on request URL, e.g. evil.com"),
      maxRequests: z.number().int().min(1).max(100).optional().describe("Max rows (default 40)"),
      includeBodies: z.boolean().optional().describe("Include bodies when present (default true)"),
    },
    async (args) => {
      try {
        return asResult(
          await readAiTestingNetworkTrace({
            storeId: ctx.storeId,
            version: ctx.version,
            runId: args.runId ?? ctx.runId,
            urlContains: args.urlContains,
            maxRequests: args.maxRequests,
            includeBodies: args.includeBodies,
          }),
        )
      } catch (err) {
        return errorResult(`ai_testing_trace failed: ${err instanceof Error ? err.message : String(err)}`)
      }
    },
    { annotations: { readOnlyHint: true } },
  )

  const base64CodecTool = tool(
    "base64_codec",
    "Encode UTF-8 text to base64 or decode base64 to UTF-8. For inspecting base64-wrapped "
      + "network bodies / API payloads (classes B/C).",
    {
      operation: z.enum(["encode", "decode"]),
      input: z.string().min(1).describe("Plain text (encode) or base64 string (decode)"),
    },
    async (args) => {
      try {
        return asResult(await runBase64Codec({ operation: args.operation, input: args.input }))
      } catch (err) {
        return errorResult(`base64_codec failed: ${err instanceof Error ? err.message : String(err)}`)
      }
    },
    { annotations: { readOnlyHint: true } },
  )

  const gzipDecodeTool = tool(
    "gzip_decode",
    "Decompress gzip data (base64 input by default). For Content-Encoding: gzip bodies "
      + "after base64_codec (classes B/C).",
    {
      input: z.string().min(1).describe("Gzip bytes as base64 (or hex when inputEncoding is hex)"),
      inputEncoding: z.enum(["base64", "hex"]).optional().describe("How input is encoded (default base64)"),
    },
    async (args) => {
      try {
        return asResult(await runGzipDecode({ input: args.input, inputEncoding: args.inputEncoding }))
      } catch (err) {
        return errorResult(`gzip_decode failed: ${err instanceof Error ? err.message : String(err)}`)
      }
    },
    { annotations: { readOnlyHint: true } },
  )

  const commitTool = buildCommitTool(ctx)

  return createSdkMcpServer({
    name: "oarmour",
    version: "1.0.0",
    tools: [
      lookupDomainWhoisTool,
      fetchWebPageTool,
      aiTestingTraceTool,
      base64CodecTool,
      gzipDecodeTool,
      commitTool,
    ],
  })
}

/** The `allowedTools` list to pre-approve every oarmour MCP tool without a prompt. */
export function oarmourAllowedTools() {
  return [
    "mcp__oarmour__lookup_domain_whois",
    "mcp__oarmour__fetch_web_page",
    "mcp__oarmour__ai_testing_trace",
    "mcp__oarmour__base64_codec",
    "mcp__oarmour__gzip_decode",
    "mcp__oarmour__commit_stage_output",
  ]
}
