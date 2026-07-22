import "server-only"

import os from "os"
import path from "path"
import {
  query,
  type Options,
  type SDKMessage,
  type McpSdkServerConfigWithInstance,
} from "@anthropic-ai/claude-agent-sdk"
import { logError, logInfo } from "@/lib/app-logger"
import { oarmourAllowedTools } from "./tools"

export interface RunStageAgentParams {
  stage: string
  systemPrompt: string
  prompt: string
  mcpServer: McpSdkServerConfigWithInstance
  runDir: string
  modelId: string
  /** Built-in tools to make available (availability layer). Defaults to Read/Glob/Grep. */
  builtinTools?: string[]
  maxTurns?: number
}

export interface StageAgentResult {
  ok: boolean
  resultText: string
  numTurns: number
  costUsd: number
  toolCalls: Array<{ name: string; input: unknown }>
  error?: string
}

/**
 * Per-stage model resolution. Precedence:
 *   1. DETECTION_<STAGE>_MODEL env (e.g. DETECTION_REPORT_MODEL)
 *   2. DETECTION_PIPELINE_MODEL env (global override)
 *   3. per-stage default below
 * Default split: find/dedupe on the strong `deepseek-v4-pro` (detection heavy-lifting +
 * judge); recon/report on the cheaper `deepseek-v4-flash` (light partitioning + writing).
 * These are DeepSeek models served via the DeepSeek Anthropic endpoint
 * (ANTHROPIC_BASE_URL=https://api.deepseek.com/anthropic). If you point the pipeline at
 * a different gateway, override via DETECTION_*_MODEL / DETECTION_PIPELINE_MODEL env.
 */
const STAGE_MODEL_DEFAULTS: Record<string, string> = {
  recon: "deepseek-v4-flash",
  find: "deepseek-v4-pro",
  dedupe: "deepseek-v4-pro",
  report: "deepseek-v4-flash",
}

function resolveModelId(stage: string): string {
  const envKey = `DETECTION_${stage.toUpperCase()}_MODEL`
  const stageEnv = process.env[envKey]?.trim()
  // `default` (or empty) means "use the built-in per-stage default".
  if (stageEnv && stageEnv.toLowerCase() !== "default") return stageEnv
  const globalEnv = process.env.DETECTION_PIPELINE_MODEL?.trim()
  if (globalEnv && globalEnv.toLowerCase() !== "default") return globalEnv
  return STAGE_MODEL_DEFAULTS[stage] || "deepseek-v4-pro"
}

/**
 * Run one pipeline stage as a single Claude Agent SDK `query()`. Deterministic
 * control flow lives in the orchestrator; this just drives one agent turn-bounded
 * session and reports tool calls + the final result.
 *
 * Security posture: `settingSources: []` (no project .claude pollution), only
 * read-only built-ins (Read/Glob/Grep) + the oarmour MCP tools are available,
 * `permissionMode: default`. The agent can only write via `commit_stage_output`.
 */
export async function runStageAgent(params: RunStageAgentParams): Promise<StageAgentResult> {
  const {
    stage,
    systemPrompt,
    prompt,
    mcpServer,
    runDir,
    builtinTools = ["Read", "Glob", "Grep"],
    maxTurns = stage === "find" ? 25 : stage === "recon" ? 10 : 10,
  } = params

  const modelId = resolveModelId(stage)
  const allowedTools = [...oarmourAllowedTools(), ...builtinTools]

  // `Options.mcpServers` is `Record<string, McpServerConfig>` (the documented record form,
  // `{ oarmour: server }`). `createSdkMcpServer` returns an `McpSdkServerConfigWithInstance`
  // (a valid server config with a live instance at runtime); cast to the expected record type.
  const mcpServers = {
    oarmour: mcpServer,
  } as unknown as NonNullable<Options["mcpServers"]>

  const options: Options = {
    systemPrompt,
    model: modelId,
    cwd: runDir,
    settingSources: [],
    permissionMode: "default",
    tools: builtinTools,
    allowedTools,
    mcpServers,
    maxTurns,
    // Isolate the binary from host-level AI config so it uses the pipeline's own
    // ANTHROPIC_API_KEY / ANTHROPIC_BASE_URL (not a developer's claude.ai OAuth).
    // `env` REPLACES process.env — spread it to keep PATH/HOME/etc., then:
    //   - unset ANTHROPIC_AUTH_TOKEN (the binary prefers it over ANTHROPIC_API_KEY,
    //     sending a host OAuth Bearer token that a custom endpoint rejects);
    //   - default ANTHROPIC_BASE_URL to the DeepSeek Anthropic endpoint if unset
    //     (binary appends /v1/messages itself, so no /v1 here);
    //   - point CLAUDE_CONFIG_DIR at an ephemeral dir so ~/.claude creds don't load.
    env: {
      ...process.env,
      ANTHROPIC_AUTH_TOKEN: undefined,
      ANTHROPIC_BASE_URL: (() => {
        const v = process.env.ANTHROPIC_BASE_URL?.trim()
        return !v || v.toLowerCase() === "default"
          ? "https://api.deepseek.com/anthropic"
          : v
      })(),
      CLAUDE_CONFIG_DIR: path.join(os.tmpdir(), "detection-pipeline-claude-config"),
    },
  }

  const toolCalls: Array<{ name: string; input: unknown }> = []
  let resultText = ""
  let numTurns = 0
  let costUsd = 0
  let errorMsg: string | undefined

  try {
    for await (const message of query({ prompt, options }) as AsyncGenerator<SDKMessage>) {
      const msg = message as SDKMessage & {
        type: string
        subtype?: string
        message?: { content?: Array<{ type: string; name?: string; input?: unknown }> }
        result?: string
        num_turns?: number
        total_cost_usd?: number
        is_error?: boolean
      }
      if (msg.type === "assistant" && msg.message?.content) {
        for (const block of msg.message.content) {
          if (block.type === "tool_use" && block.name) {
            toolCalls.push({ name: block.name, input: block.input })
          }
        }
      } else if (msg.type === "result") {
        resultText = msg.result ?? ""
        numTurns = msg.num_turns ?? 0
        costUsd = msg.total_cost_usd ?? 0
        if (msg.is_error) {
          errorMsg = `stage ${stage} ended in error (subtype=${msg.subtype})`
        }
      }
    }
  } catch (err) {
    logError("[detection-pipeline] query() threw", {
      stage,
      error: err instanceof Error ? err.message : String(err),
    })
    return {
      ok: false,
      resultText,
      numTurns,
      costUsd,
      toolCalls,
      error: err instanceof Error ? err.message : String(err),
    }
  }

  logInfo("[detection-pipeline] stage agent done", {
    stage,
    modelId,
    numTurns,
    costUsd,
    toolCallCount: toolCalls.length,
    ok: !errorMsg,
  })

  return {
    ok: !errorMsg,
    resultText,
    numTurns,
    costUsd,
    toolCalls,
    error: errorMsg,
  }
}
