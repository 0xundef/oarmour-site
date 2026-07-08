/**
 * Issue investigation chatbox (Anthropic-compatible).
 * Runtime uses `@ai-sdk/anthropic` pointed at an Anthropic-compatible endpoint
 * (default: DeepSeek's Anthropic endpoint at https://api.deepseek.com/anthropic).
 * The Anthropic SDK appends `/v1/messages` itself, so baseURL has no `/v1`.
 *
 * Env convention: an env value of `default` (or empty/absent) means "use the
 * built-in default" — so GitHub vars can be created with the literal word
 * `default` when no override is wanted (GitHub forbids empty var values).
 *
 * GitHub Actions:
 * - secrets.ANTHROPIC_CHATBOX_API_KEY  (real key; NOT "default")
 * - vars.ANTHROPIC_CHATBOX_BASE_URL    (default = https://api.deepseek.com/anthropic)
 * - vars.ANTHROPIC_CHATBOX_MODEL       (default = deepseek-v4-flash; or comma-separated allowlist)
 * - vars.ANTHROPIC_CHATBOX_THINKING    (default = adaptive; or disabled|enabled|adaptive)
 *
 * Distinct from the detection pipeline's ANTHROPIC_API_KEY / ANTHROPIC_BASE_URL.
 */
export type AnthropicChatboxConfig = {
  apiKey: string
  baseURL: string
  model: string
}

const DEFAULT_CHATBOX_MODEL = "deepseek-v4-flash"
const DEFAULT_CHATBOX_BASE_URL = "https://api.deepseek.com/anthropic"

/** Treat empty or the literal word `default` as "use the built-in default". */
function envOr(raw: string | undefined, builtin: string): string {
  const v = raw?.trim()
  return !v || v.toLowerCase() === "default" ? builtin : v
}

/** Parse ANTHROPIC_CHATBOX_MODEL (comma-separated) into an allowlist; `default`/empty → [default model]. */
export function parseAnthropicChatboxModels(raw?: string | null): string[] {
  const v = raw?.trim()
  if (!v || v.toLowerCase() === "default") return [DEFAULT_CHATBOX_MODEL]
  const list = v
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
  return list.length > 0 ? list : [DEFAULT_CHATBOX_MODEL]
}

export function isAnthropicChatboxConfigured(): boolean {
  const k = process.env.ANTHROPIC_CHATBOX_API_KEY?.trim() ?? ""
  return k.length > 0 && k.toLowerCase() !== "default"
}

export function listAnthropicChatboxModels(): string[] {
  return parseAnthropicChatboxModels(process.env.ANTHROPIC_CHATBOX_MODEL)
}

/** Pick a model id from the env allowlist; unknown requests fall back to the first entry. */
export function resolveAnthropicChatboxModelId(requested?: string | null): string {
  const allowed = listAnthropicChatboxModels()
  const trimmed = requested?.trim()
  if (trimmed && trimmed.toLowerCase() !== "default" && allowed.includes(trimmed)) return trimmed
  return allowed[0]!
}

export function getAnthropicChatboxConfig(modelId?: string | null): AnthropicChatboxConfig | null {
  const apiKey = process.env.ANTHROPIC_CHATBOX_API_KEY?.trim()
  if (!apiKey || apiKey.toLowerCase() === "default") {
    return null
  }

  return {
    apiKey,
    baseURL: envOr(process.env.ANTHROPIC_CHATBOX_BASE_URL, DEFAULT_CHATBOX_BASE_URL),
    model: resolveAnthropicChatboxModelId(modelId),
  }
}
