import { tool } from "ai"
import { z } from "zod"
import { locateDomainInSource } from "@/lib/domain-code-locator"

export function createIssueChatTools(ctx: { storeId: string }) {
  return {
    locate_domain_in_source: tool({
      description:
        "Find where a domain (or URL host) appears in the extension's packaged source files or latest runtime network.json. Returns file paths with surrounding code lines so you can interpret how the domain is used.",
      inputSchema: z.object({
        domain: z
          .string()
          .min(3)
          .describe("Apex domain or full hostname/URL to locate, e.g. evil.example.com"),
      }),
      execute: async ({ domain }) => {
        return locateDomainInSource({ storeId: ctx.storeId, domain })
      },
    }),
  }
}

export type IssueChatTools = ReturnType<typeof createIssueChatTools>
