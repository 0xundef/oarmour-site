import type { UIMessage } from 'ai'
import { isToolUIPart } from 'ai'

export function getMessageText(message: UIMessage): string {
  return message.parts
    .filter((p) => p.type === 'text' && typeof p.text === 'string')
    .map((p) => (p as { text: string }).text)
    .join('\n')
}

/** Assistant asked to dismiss / allowlist in prose instead of calling propose_* tools. */
export function assistantOffersResolutionActions(text: string): boolean {
  const lower = text.toLowerCase()
  if (!lower.trim()) return false
  const hasOffer =
    /\b(would you like|do you want|shall i|should i|want me to)\b/i.test(text) ||
    /\b(you can|i can)\b.*\b(dismiss|false positive|allowlist)\b/i.test(text)
  const hasAction =
    /\b(dismiss|false positive|allowlist|mark as)\b/i.test(lower)
  return hasOffer && hasAction
}

export function lastAssistantMessage(messages: UIMessage[]): UIMessage | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i]?.role === 'assistant') return messages[i]!
  }
  return null
}

/** Hide duplicate button row when propose_* tool cards are already awaiting confirm. */
export function hasPendingResolutionToolProposal(messages: UIMessage[]): boolean {
  const last = lastAssistantMessage(messages)
  if (!last) return false

  for (const part of last.parts) {
    if (!isToolUIPart(part) || part.state !== 'output-available' || part.output == null) continue
    const type = part.type
    if (type !== 'tool-propose_add_allowlist' && type !== 'tool-propose_dismiss_finding') continue
    const out = part.output as { status?: string }
    if (out.status === 'pending_confirmation') return true
  }
  return false
}

export function shouldShowInlineResolutionActions(params: {
  messages: UIMessage[]
  findingIsActive: boolean
  isBusy: boolean
  shareMode: boolean
  dismissedInline: boolean
}): boolean {
  if (params.shareMode || !params.findingIsActive || params.isBusy || params.dismissedInline) {
    return false
  }
  if (hasPendingResolutionToolProposal(params.messages)) return false
  const last = lastAssistantMessage(params.messages)
  if (!last || !messageHasVisibleText(last)) return false
  return assistantOffersResolutionActions(getMessageText(last))
}

function messageHasVisibleText(message: UIMessage): boolean {
  return message.parts.some((p) => p.type === 'text' && (p.text ?? '').trim().length > 0)
}
