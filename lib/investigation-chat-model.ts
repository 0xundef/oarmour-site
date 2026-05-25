import { createDeepSeek, type DeepSeekLanguageModelOptions } from "@ai-sdk/deepseek"
import type { LanguageModel } from "ai"
import {
  getOpenAiChatboxConfig,
  isOpenAiChatboxConfigured,
  listOpenAiChatboxModels,
  resolveOpenAiChatboxModelId,
  type OpenAiChatboxConfig,
} from "@/lib/openai-chatbox-config"

export type DeepSeekThinkingMode = "disabled" | "enabled" | "adaptive"

/**
 * `@ai-sdk/openai` uses `…/v1/chat/completions`; official DeepSeek is `…/chat/completions`.
 * @see https://api-docs.deepseek.com/zh-cn/
 */
function deepSeekProviderBaseUrl(openAiCompatibleBaseUrl: string): string {
  const trimmed = openAiCompatibleBaseUrl.replace(/\/$/, "")
  try {
    const host = new URL(trimmed).hostname
    if (host === "api.deepseek.com") {
      return trimmed.replace(/\/v1$/i, "")
    }
  } catch {
    // fall through
  }
  return trimmed
}

/**
 * Thinking + tool calls: reasoning_content must round-trip (thinking mode only).
 * Non-thinking tool flow: https://api-docs.deepseek.com/zh-cn/guides/tool_calls
 * Thinking tool flow: https://api-docs.deepseek.com/zh-cn/guides/thinking_mode
 *
 * Override with OPENAI_CHATBOX_THINKING=disabled|enabled|adaptive
 */
export function resolveInvestigationThinkingMode(model: string): DeepSeekThinkingMode {
  const env = process.env.OPENAI_CHATBOX_THINKING?.trim().toLowerCase()
  if (env === "disabled" || env === "enabled" || env === "adaptive") {
    return env
  }
  if (/reasoner/i.test(model)) return "enabled"
  if (/^deepseek-chat$/i.test(model)) return "disabled"
  if (/v4/i.test(model)) return "enabled"
  return "disabled"
}

export function resolveInvestigationProviderOptions(
  model: string,
): { deepseek: DeepSeekLanguageModelOptions } {
  return {
    deepseek: {
      thinking: { type: resolveInvestigationThinkingMode(model) },
    },
  }
}

export function createInvestigationLanguageModel(
  config: OpenAiChatboxConfig,
): LanguageModel {
  const deepseek = createDeepSeek({
    apiKey: config.apiKey,
    baseURL: deepSeekProviderBaseUrl(config.baseURL),
  })
  return deepseek.chat(config.model)
}

export function listInvestigationChatModels(): {
  models: string[]
  defaultModel: string
} | null {
  if (!isOpenAiChatboxConfigured()) return null
  const models = listOpenAiChatboxModels()
  return {
    models,
    defaultModel: resolveOpenAiChatboxModelId(),
  }
}

export function getInvestigationLanguageModel(modelId?: string | null): {
  model: LanguageModel
  modelId: string
} | null {
  const config = getOpenAiChatboxConfig(modelId)
  if (!config) return null
  return {
    model: createInvestigationLanguageModel(config),
    modelId: config.model,
  }
}
