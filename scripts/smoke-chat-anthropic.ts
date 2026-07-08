/**
 * Smoke test for the investigation chat's Anthropic provider wiring (REAL factory path).
 * Verifies: getInvestigationLanguageModel() + resolveInvestigationProviderOptions()
 * + streamText (text + tool-use) work through @ai-sdk/anthropic against the configured
 * Anthropic-compatible endpoint.
 *
 * Run against the DeepSeek Anthropic endpoint with the local test key:
 *   NODE_OPTIONS='--conditions react-server' \
 *   ANTHROPIC_CHATBOX_API_KEY=sk-... \
 *   ANTHROPIC_CHATBOX_BASE_URL=https://api.deepseek.com/anthropic \
 *   ANTHROPIC_CHATBOX_MODEL=deepseek-v4-flash \
 *   npx tsx scripts/smoke-chat-anthropic.ts
 */
import { streamText, tool } from "ai"
import { z } from "zod"
import {
  getInvestigationLanguageModel,
  resolveInvestigationProviderOptions,
} from "@/lib/investigation-chat-model"

async function main() {
  const lm = getInvestigationLanguageModel()
  if (!lm) {
    console.error("ANTHROPIC_CHATBOX_API_KEY not set; cannot build model.")
    process.exit(2)
  }
  console.log("model:", lm.modelId)
  const providerOptions = resolveInvestigationProviderOptions(lm.modelId)
  console.log("providerOptions:", JSON.stringify(providerOptions))

  const tools = {
    get_local_time: tool({
      description: "Return the current local time string.",
      inputSchema: z.object({}),
      execute: async () => ({ now: new Date().toISOString() }),
    }),
  }

  const result = streamText({
    model: lm.model,
    system: "You are a terse assistant. Use the get_local_time tool when asked the time.",
    prompt: "What time is it? Then say 'chat anthropic smoke ok' in exactly those words.",
    tools,
    stopWhen: ({ steps }) => steps.length >= 4,
    providerOptions,
  })

  for await (const chunk of result.textStream) {
    process.stdout.write(chunk)
  }
  console.log("\n--- finish ---")
  console.log("usage:", JSON.stringify(await result.usage))
  console.log("toolCalls:", JSON.stringify(await result.toolCalls))
}

main().catch((e) => {
  console.error("smoke failed:", e)
  process.exit(1)
})
