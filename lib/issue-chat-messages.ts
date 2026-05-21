import type { UIMessage } from "ai"
import { buildIssueDetailContextText } from "@/lib/issue-chat-context"
import type { WorkbenchCheckItem } from "@/lib/workbench-check-items"

export const CONTEXT_MESSAGE_PREFIX = "issue-context-"

export function buildIssueChatId(userId: string, storeId: string, issueId: string): string {
  return `investigation:${userId}:${storeId}:${issueId}`
}

export function buildInitialContextMessage(issue: WorkbenchCheckItem): UIMessage {
  return {
    id: `${CONTEXT_MESSAGE_PREFIX}${issue.id}`,
    role: "user",
    parts: [{ type: "text", text: buildIssueDetailContextText(issue) }],
  }
}

export function isContextSeedMessage(message: UIMessage): boolean {
  return message.id.startsWith(CONTEXT_MESSAGE_PREFIX)
}

/** Refresh the finding context seed while keeping the rest of the thread. */
export function mergeLoadedMessagesWithSeed(
  stored: UIMessage[],
  issue: WorkbenchCheckItem,
): UIMessage[] {
  const seed = buildInitialContextMessage(issue)
  if (stored.length === 0) return [seed]

  const seedIndex = stored.findIndex(isContextSeedMessage)
  if (seedIndex === 0) return [seed, ...stored.slice(1)]
  if (seedIndex > 0) {
    return [seed, ...stored.filter((message) => !isContextSeedMessage(message))]
  }
  return [seed, ...stored]
}
