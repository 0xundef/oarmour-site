import { tool } from "ai"
import { z } from "zod"
import { locateDomainInSource, parseFindingFilePath } from "@/lib/domain-code-locator"
import { lookupDomainWhois } from "@/lib/domain-whois-lookup"

export function createIssueChatTools(ctx: {
  storeId: string
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
  }
}

export type IssueChatTools = ReturnType<typeof createIssueChatTools>
