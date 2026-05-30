import { tool } from "ai"
import { z } from "zod"
import { readAiTestingNetworkTrace } from "@/lib/ai-testing-trace-read"
import { runBase64Codec, runGzipDecode } from "@/lib/binary-payload-codec"
import { locateDomainInSource, parseFindingFilePath } from "@/lib/domain-code-locator"
import { lookupDomainWhois } from "@/lib/domain-whois-lookup"
import { fetchWebPage } from "@/lib/web-page-fetch"
import { normalizeAllowlistDomain } from "@/lib/finding-resolution"
import { findingDismissalReasonSchema } from "@/lib/issue-chat-tool-proposals"
import { runExtensionInvestigationTool } from "@/lib/extension-investigation-fs"
import { resolveIssueExtensionArtifact } from "@/lib/issue-extension-artifact"

export function createIssueChatTools(ctx: {
  storeId: string
  issueId: string
  findingFile?: string
}) {
  const priorityFilePaths = ctx.findingFile
    ? ([parseFindingFilePath(ctx.findingFile)].filter(Boolean) as string[])
    : []

  return {
    lookup_domain_whois: tool({
      description:
        "Look up domain registration signals (RDAP with WHOIS fallback), same as static analysis enrichment. Returns registrar, creation/expiry dates, nameservers, and domain age in days. Call at most once per apex domain per investigation.",
      inputSchema: z.object({
        domain: z
          .string()
          .min(3)
          .describe("Apex domain or hostname, e.g. metrics-trustwallet.com"),
      }),
      execute: async ({ domain }) => lookupDomainWhois(domain),
    }),
    locate_domain_in_source: tool({
      description:
        "Find where a domain appears in extension source. Returns compact snippets (~120 chars before/after each match). Call at most once per investigation unless the user gives a new domain.",
      inputSchema: z.object({
        domain: z
          .string()
          .min(3)
          .describe("Apex domain or hostname to locate, e.g. metrics-trustwallet.com"),
      }),
      execute: async ({ domain }) => {
        return locateDomainInSource({
          storeId: ctx.storeId,
          domain,
          priorityFilePaths,
        })
      },
    }),
    fetch_web_page: tool({
      description:
        "Fetch a public HTTPS page and return its title plus a plain-text excerpt for factual checks (vendor docs, reputation pages, blocklists). Use only for URLs relevant to the finding. Call at most once per URL per investigation.",
      inputSchema: z.object({
        url: z.string().url().describe("Full HTTPS URL, e.g. https://example.com/path"),
      }),
      execute: async ({ url }) => fetchWebPage(url),
    }),
    ai_testing_trace: tool({
      description:
        "Read browser AI test network traffic for this extension: prefers ai_testing/<runId>/network.json (includes POST requestBody when captured). Falls back to the latest Playwright trace .network file under .playwright-cli/traces. Filter by urlContains when investigating a specific host. Call once per investigation unless the user asks for another run.",
      inputSchema: z.object({
        runId: z
          .string()
          .optional()
          .describe("ai_testing session id; default is the latest run with recordings.json"),
        urlContains: z
          .string()
          .optional()
          .describe("Substring filter on request URL, e.g. metrics-trustwallet.com"),
        maxRequests: z
          .number()
          .int()
          .min(1)
          .max(100)
          .optional()
          .describe("Max rows to return (default 40)"),
        includeBodies: z
          .boolean()
          .optional()
          .describe("Include request/response bodies when present (default true)"),
      }),
      execute: async ({ runId, urlContains, maxRequests, includeBodies }) => {
        const artifact = await resolveIssueExtensionArtifact(ctx.storeId)
        if (!artifact) {
          return {
            ok: false,
            error: "Extension version or sidecar not found for this store.",
            requests: [],
          }
        }
        return readAiTestingNetworkTrace({
          storeId: ctx.storeId,
          version: artifact.version,
          runId,
          urlContains,
          maxRequests,
          includeBodies,
        })
      },
    }),
    base64_codec: tool({
      description:
        "Encode UTF-8 text to base64 or decode base64 to UTF-8. Use when network bodies or API payloads are base64-wrapped.",
      inputSchema: z.object({
        operation: z.enum(["encode", "decode"]),
        input: z.string().min(1).describe("Plain text (encode) or base64 string (decode)"),
      }),
      execute: async ({ operation, input }) => runBase64Codec({ operation, input }),
    }),
    grep: tool({
      description:
        "Search unpacked extension source (or sidecar with root=sidecar) for a regex or literal pattern. Returns file:line matches. Default root is the extension package; use root=sidecar for analysis/ or ai_testing/. Output is truncated.",
      inputSchema: z.object({
        pattern: z.string().min(1).describe("Regex or literal string to search for"),
        path: z
          .string()
          .optional()
          .describe("Directory or file relative to root (default .)"),
        root: z
          .enum(["extension", "sidecar"])
          .optional()
          .describe("Search in unpacked extension (default) or sidecar data"),
        glob: z
          .string()
          .optional()
          .describe("Optional file glob filter, e.g. '*.js' or '**/*.json'"),
        ignoreCase: z.boolean().optional().describe("Case-insensitive search"),
        literal: z.boolean().optional().describe("Treat pattern as literal text, not regex"),
        context: z
          .number()
          .int()
          .min(0)
          .max(20)
          .optional()
          .describe("Lines of context before/after each match"),
        limit: z
          .number()
          .int()
          .min(1)
          .max(500)
          .optional()
          .describe("Max matches to return (default 100)"),
      }),
      execute: async (input) => runExtensionInvestigationTool(ctx.storeId, "grep", input),
    }),
    find: tool({
      description:
        "Find files by glob pattern under the extension package or sidecar. Examples: '*.js', '**/*.json', 'manifest.json'. Default root is extension.",
      inputSchema: z.object({
        pattern: z
          .string()
          .min(1)
          .describe("Glob pattern, e.g. '*.ts' or 'src/**/*.spec.ts'"),
        path: z
          .string()
          .optional()
          .describe("Directory to search relative to root (default .)"),
        root: z.enum(["extension", "sidecar"]).optional(),
        limit: z
          .number()
          .int()
          .min(1)
          .max(2000)
          .optional()
          .describe("Max file paths to return (default 1000)"),
      }),
      execute: async (input) => runExtensionInvestigationTool(ctx.storeId, "find", input),
    }),
    ls: tool({
      description:
        "List a directory in the unpacked extension or sidecar. Entries use a trailing / for directories. Default root is extension.",
      inputSchema: z.object({
        path: z
          .string()
          .optional()
          .describe("Directory relative to root (default .)"),
        root: z.enum(["extension", "sidecar"]).optional(),
        limit: z
          .number()
          .int()
          .min(1)
          .max(2000)
          .optional()
          .describe("Max entries to return (default 500)"),
      }),
      execute: async (input) => runExtensionInvestigationTool(ctx.storeId, "ls", input),
    }),
    gzip_decode: tool({
      description:
        "Decompress gzip-compressed data (expects base64 input by default). Use on Content-Encoding: gzip bodies after base64_codec if needed.",
      inputSchema: z.object({
        input: z
          .string()
          .min(1)
          .describe("Gzip bytes as base64 (or hex when inputEncoding is hex)"),
        inputEncoding: z
          .enum(["base64", "hex"])
          .optional()
          .describe("How input is encoded (default base64)"),
      }),
      execute: async ({ input, inputEncoding }) =>
        runGzipDecode({ input, inputEncoding }),
    }),
    propose_add_allowlist: tool({
      description:
        "Suggest adding an apex domain to this extension's allowlist after investigation. Does NOT apply until the user confirms in the UI. Use the apex domain (e.g. nebl.io), not a full URL. Call at most once per domain per conversation unless the user asks again.",
      inputSchema: z.object({
        domain: z.string().min(3).describe("Apex domain, e.g. nebl.io"),
        rationale: z
          .string()
          .min(10)
          .describe("Short explanation shown on the confirm card (1-2 sentences)"),
        note: z.string().optional().describe("Optional note stored on the allowlist entry"),
      }),
      execute: async ({ domain, rationale, note }) => ({
        kind: "allowlist_proposal" as const,
        domain: normalizeAllowlistDomain(domain),
        rationale,
        note: note?.trim() || null,
        status: "pending_confirmation" as const,
      }),
    }),
    propose_dismiss_finding: tool({
      description:
        "Suggest marking the CURRENT finding as a false positive after investigation. Does NOT apply until the user confirms. Call at most once per conversation unless the user reopens the issue.",
      inputSchema: z.object({
        reason: findingDismissalReasonSchema.describe("Best-matching dismissal reason"),
        rationale: z.string().min(10).describe("Shown on the confirm card"),
        note: z.string().optional(),
        alsoAllowlistDomain: z
          .boolean()
          .optional()
          .default(false)
          .describe(
            "If true and this finding is a malicious-domain issue, also add the apex domain to the allowlist on confirm",
          ),
      }),
      execute: async ({ reason, rationale, note, alsoAllowlistDomain }) => ({
        kind: "dismiss_proposal" as const,
        issueId: ctx.issueId,
        reason,
        rationale,
        note: note?.trim() || null,
        alsoAllowlistDomain: alsoAllowlistDomain ?? false,
        status: "pending_confirmation" as const,
      }),
    }),
  }
}

export type IssueChatTools = ReturnType<typeof createIssueChatTools>
