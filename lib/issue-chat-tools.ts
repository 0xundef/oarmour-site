import { tool } from "ai"
import { z } from "zod"
import { locateDomainInSource, parseFindingFilePath } from "@/lib/domain-code-locator"

export function createIssueChatTools(ctx: {
  storeId: string
  findingFile?: string
}) {
  const priorityFilePaths = ctx.findingFile
    ? ([parseFindingFilePath(ctx.findingFile)].filter(Boolean) as string[])
    : []

  return {
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
