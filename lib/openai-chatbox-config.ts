/**
 * Issue investigation chatbox (DeepSeek / OpenAI-compatible).
 * Runtime uses `@ai-sdk/deepseek` for correct thinking-mode + tool `reasoning_content` round-trip.
 *
 * GitHub Actions:
 * - secrets.OPENAI_CHATBOX_API_KEY
 * - vars.OPENAI_CHATBOX_BASE_URL
 * - vars.OPENAI_CHATBOX_MODEL — comma-separated allowlist, e.g. deepseek-v4-pro,deepseek-v4-flash
 *
 * Local: same names in `.env.local`.
 *
 * Optional: OPENAI_CHATBOX_THINKING=disabled|enabled|adaptive
 * (see lib/investigation-chat-model.ts; tool+thinking needs @ai-sdk/deepseek).
 */
export type OpenAiChatboxConfig = {
  apiKey: string
  baseURL: string
  model: string
}

const DEFAULT_CHATBOX_MODEL = "deepseek-chat"

function openAiCompatibleBaseUrl(raw: string): string {
  const trimmed = raw.replace(/\/$/, "")
  return trimmed.endsWith("/v1") ? trimmed : `${trimmed}/v1`
}

/** Parse OPENAI_CHATBOX_MODEL (comma-separated) into an allowlist of model ids. */
export function parseOpenAiChatboxModels(raw?: string | null): string[] {
  if (!raw?.trim()) return [DEFAULT_CHATBOX_MODEL]
  const list = raw
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
  return list.length > 0 ? list : [DEFAULT_CHATBOX_MODEL]
}

export function isOpenAiChatboxConfigured(): boolean {
  return Boolean(process.env.OPENAI_CHATBOX_API_KEY?.trim())
}

export function listOpenAiChatboxModels(): string[] {
  return parseOpenAiChatboxModels(process.env.OPENAI_CHATBOX_MODEL)
}

/** Pick a model id from the env allowlist; unknown requests fall back to the first entry. */
export function resolveOpenAiChatboxModelId(requested?: string | null): string {
  const allowed = listOpenAiChatboxModels()
  const trimmed = requested?.trim()
  if (trimmed && allowed.includes(trimmed)) return trimmed
  return allowed[0]!
}

export function getOpenAiChatboxConfig(modelId?: string | null): OpenAiChatboxConfig | null {
  const apiKey = process.env.OPENAI_CHATBOX_API_KEY?.trim()
  if (!apiKey) {
    return null
  }

  return {
    apiKey,
    baseURL: openAiCompatibleBaseUrl(
      process.env.OPENAI_CHATBOX_BASE_URL?.trim() || "https://api.deepseek.com",
    ),
    model: resolveOpenAiChatboxModelId(modelId),
  }
}
