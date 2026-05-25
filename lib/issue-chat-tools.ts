import { tool } from "ai"
import { z } from "zod"
import { locateDomainInSource, parseFindingFilePath } from "@/lib/domain-code-locator"
import { lookupDomainWhois } from "@/lib/domain-whois-lookup"
import { fetchWebPage } from "@/lib/web-page-fetch"
import { normalizeAllowlistDomain } from "@/lib/finding-resolution"
import { findingDismissalReasonSchema } from "@/lib/issue-chat-tool-proposals"

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
