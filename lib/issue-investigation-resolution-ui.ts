import type { UIMessage } from 'ai'
import { isToolUIPart } from 'ai'

export function getMessageText(message: UIMessage): string {
  return message.parts
    .filter((p) => p.type === 'text' && typeof p.text === 'string')
    .map((p) => (p as { text: string }).text)
    .join('\n')
}

function messageHasVisibleText(message: UIMessage): boolean {
  return message.parts.some((p) => p.type === 'text' && (p.text ?? '').trim().length > 0)
}

/** Assistant explicitly offers to dismiss / allowlist in prose. */
function assistantExplicitlyOffersActions(text: string): boolean {
  const lower = text.toLowerCase()
  const hasOffer =
    /\b(would you like|do you want|shall i|should i|want me to)\b/i.test(text) ||
    /\b(you can|i can)\b.*\b(dismiss|false positive|allowlist)\b/i.test(text)
  const hasAction =
    /\b(dismiss|false positive|allowlist|mark as)\b/i.test(lower)
  return hasOffer && hasAction
}

/**
 * Investigation reached a closing recommendation (verdict, false positive, allowlist, etc.)
 * without calling propose_* tools.
 */
export function assistantRecommendsResolutionActions(text: string): boolean {
  const lower = text.toLowerCase()
  if (!lower.trim()) return false

  if (assistantExplicitlyOffersActions(text)) return true

  if (/\b(recommend|suggest)(ed|s|ing)?\b/i.test(text) && /\b(dismiss|allowlist|false positive)\b/i.test(lower)) {
    return true
  }

  if (/\bmark\b.*\b(false positive|as fp)\b/i.test(lower)) return true

  if (/\b(add|adding)\b.*\b(allowlist|to the allowlist)\b/i.test(lower)) return true

  const hasVerdict = /\bverdict\s*:/i.test(text)
  if (
    hasVerdict &&
    /\b(false positive|allowlist|dismiss|malicious|phishing|appropriate|severity)\b/i.test(lower)
  ) {
    return true
  }

  if (
    /\b(investigation|analysis)\b.*\b(complete|conclude|conclusion)\b/i.test(lower) &&
    /\b(dismiss|allowlist|false positive)\b/i.test(lower)
  ) {
    return true
  }

  return false
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

export function getInlineResolutionActionsMessageId(params: {
  messages: UIMessage[]
  findingIsActive: boolean
  isBusy: boolean
  shareMode: boolean
  dismissedMessageId: string | null
}): string | null {
  if (params.shareMode || !params.findingIsActive || params.isBusy) return null
  if (hasPendingResolutionToolProposal(params.messages)) return null

  const last = lastAssistantMessage(params.messages)
  if (!last || !messageHasVisibleText(last)) return null
  if (params.dismissedMessageId === last.id) return null

  if (!assistantRecommendsResolutionActions(getMessageText(last))) return null

  return last.id
}
