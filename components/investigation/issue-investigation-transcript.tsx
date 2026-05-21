"use client"

import { isToolUIPart, type UIMessage } from "ai"
import { cn } from "@/lib/utils"
import { IssueContextDisplay } from "@/components/dashboard/issue-context-display"
import { IssueChatToolPart } from "@/components/dashboard/issue-chat-tool-part"
import { isContextSeedMessage } from "@/lib/issue-chat-messages"
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message"
import type { WorkbenchCheckItem } from "@/lib/workbench-check-items"

export function IssueInvestigationTranscript({
  issue,
  messages,
}: {
  issue: WorkbenchCheckItem
  messages: UIMessage[]
}) {
  return (
    <>
      {messages.map((message) => {
        const isContextSeed = isContextSeedMessage(message)

        return (
          <Message key={message.id} from={message.role}>
            <MessageContent
              className={cn(
                isContextSeed &&
                  "max-w-full rounded-lg border border-dashed border-muted-foreground/30 bg-muted/40 px-4 py-3",
              )}
            >
              {isContextSeed ? (
                <IssueContextDisplay issue={issue} />
              ) : (
                message.parts.map((part, partIndex) => {
                  if (isToolUIPart(part)) {
                    return (
                      <IssueChatToolPart
                        key={`${message.id}-tool-${partIndex}`}
                        part={part}
                      />
                    )
                  }
                  if (part.type !== "text" || !part.text) return null

                  if (message.role === "assistant") {
                    return (
                      <MessageResponse key={`${message.id}-${partIndex}`}>
                        {part.text}
                      </MessageResponse>
                    )
                  }

                  return (
                    <div
                      key={`${message.id}-${partIndex}`}
                      className="whitespace-pre-wrap text-sm leading-6"
                    >
                      {part.text}
                    </div>
                  )
                })
              )}
            </MessageContent>
          </Message>
        )
      })}
    </>
  )
}
