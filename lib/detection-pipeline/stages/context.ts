import "server-only"

import { loadPipelineSkill } from "../load-skill"
import type { CandidateEvidence } from "../evidence"
import type { PipelineArtifact } from "../storage"

export interface StageContext {
  storeId: string
  version: string
  runId?: string
  runDir: string
  modelId: string
  threatModelRef: string
  threatModelBody: string
  artifact: PipelineArtifact
  evidence: CandidateEvidence
  source: "static" | "runtime" | "general"
}

/** Compose a stage's SOP + the threat-model corpus into the agent system prompt. */
export function buildStageSystemPrompt(stage: "recon" | "find" | "dedupe" | "report", ctx: StageContext): string {
  const sop = loadPipelineSkill(stage)
  return [
    "# STAGE SOP",
    sop,
    "",
    "# THREAT MODEL (chrome-ext-audit)",
    ctx.threatModelBody,
    "",
    "# Pipeline contract",
    "You are running inside a detection pipeline. Your ONLY way to commit structured output is the",
    "`mcp__oarmour__commit_stage_output` tool. Call it as your final action with the payload shape",
    "described in the STAGE SOP. You have read-only built-in tools (Read/Glob/Grep) and the oarmour",
    "MCP investigation tools. You cannot run Bash, Write, or Edit — writing happens only through",
    "commit_stage_output. 'Clean' is a valid result; never invent a finding.",
  ].join("\n")
}
