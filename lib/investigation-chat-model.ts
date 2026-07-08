import { createAnthropic } from "@ai-sdk/anthropic"
import type { LanguageModel } from "ai"
import {
  getAnthropicChatboxConfig,
  isAnthropicChatboxConfigured,
  listAnthropicChatboxModels,
  resolveAnthropicChatboxModelId,
  type AnthropicChatboxConfig,
} from "@/lib/anthropic-chatbox-config"

export type AnthropicThinkingMode = "disabled" | "enabled" | "adaptive"

/**
 * Thinking mode for the chat. Override with `ANTHROPIC_CHATBOX_THINKING=
 * disabled|enabled|adaptive`. Default `adaptive`: enable for reasoner-class
 * models (deepseek-reasoner / v4-pro), disabled otherwise. DeepSeek's Anthropic
 * endpoint supports the `thinking` field (budget_tokens is ignored).
 */
export function resolveInvestigationThinkingMode(model: string): AnthropicThinkingMode {
  const env = process.env.ANTHROPIC_CHATBOX_THINKING?.trim().toLowerCase()
  if (env === "disabled" || env === "enabled" || env === "adaptive") {
    return env
  }
  if (/reasoner|v4-pro/i.test(model)) return "enabled"
  return "disabled"
}

/**
 * Anthropic provider options for `streamText`. When thinking is enabled, passes
 * `{ anthropic: { thinking: { type: "enabled", budgetTokens } } }` (budgetTokens
 * is nominal — DeepSeek's endpoint ignores it; `@ai-sdk/anthropic` requires it
 * when type is "enabled"). When disabled, no thinking field is set.
 */
export function resolveInvestigationProviderOptions(
  model: string,
): { anthropic: { thinking?: { type: "enabled"; budgetTokens: number } } } {
  const mode = resolveInvestigationThinkingMode(model)
  if (mode === "enabled") {
    return { anthropic: { thinking: { type: "enabled", budgetTokens: 4000 } } }
  }
  return { anthropic: {} }
}

export function createInvestigationLanguageModel(
  config: AnthropicChatboxConfig,
): LanguageModel {
  const anthropic = createAnthropic({
    apiKey: config.apiKey,
    baseURL: config.baseURL,
  })
  return anthropic(config.model)
}

export function listInvestigationChatModels(): {
  models: string[]
  defaultModel: string
} | null {
  if (!isAnthropicChatboxConfigured()) return null
  const models = listAnthropicChatboxModels()
  return {
    models,
    defaultModel: resolveAnthropicChatboxModelId(),
  }
}

export function getInvestigationLanguageModel(modelId?: string | null): {
  model: LanguageModel
  modelId: string
} | null {
  const config = getAnthropicChatboxConfig(modelId)
  if (!config) return null
  return {
    model: createInvestigationLanguageModel(config),
    modelId: config.model,
  }
}
