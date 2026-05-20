/**
 * Issue investigation chatbox (DeepSeek / OpenAI-compatible).
 *
 * GitHub Actions:
 * - secrets.OPENAI_CHATBOX_API_KEY
 * - vars.OPENAI_CHATBOX_BASE_URL
 * - vars.OPENAI_CHATBOX_MODEL
 *
 * Local: same names in `.env.local`.
 */
export type OpenAiChatboxConfig = {
  apiKey: string
  baseURL: string
  model: string
}

function openAiCompatibleBaseUrl(raw: string): string {
  const trimmed = raw.replace(/\/$/, "")
  return trimmed.endsWith("/v1") ? trimmed : `${trimmed}/v1`
}

export function getOpenAiChatboxConfig(): OpenAiChatboxConfig | null {
  const apiKey = process.env.OPENAI_CHATBOX_API_KEY?.trim()
  if (!apiKey) {
    return null
  }

  return {
    apiKey,
    baseURL: openAiCompatibleBaseUrl(
      process.env.OPENAI_CHATBOX_BASE_URL?.trim() || "https://api.deepseek.com",
    ),
    model: process.env.OPENAI_CHATBOX_MODEL?.trim() || "deepseek-chat",
  }
}
