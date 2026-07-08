import "server-only"

import fs from "fs"
import { logError, logInfo } from "@/lib/app-logger"
import { loadStoreSuppressions } from "@/lib/finding-resolution-store"
import { normalizeAllowlistDomain } from "@/lib/finding-resolution"
import { runStageAgent } from "../agent"
import { createOarmourMcpServer } from "../tools"
import {
  getPipelineStagePath,
} from "../storage"
import {
  DedupeOutputSchema,
  type DedupeOutput,
  type Finding,
  type KnownFindingsManifest,
  type MergedFindingsFile,
  type Verdict,
} from "../schemas"
import { loadKnownFindings, saveKnownFindings, applyVerdictsToKnownFindings } from "../known-findings"
import { buildStageSystemPrompt, type StageContext } from "./context"

function extractFindingDomains(f: Finding): string[] {
  const out = new Set<string>()
  for (const ev of f.evidence) {
    if (ev.domain) out.add(normalizeAllowlistDomain(ev.domain))
  }
  if (f.remoteUrl) {
    try {
      const h = new URL(f.remoteUrl).hostname
      out.add(normalizeAllowlistDomain(h))
    } catch { /* not a URL */ }
  }
  if (f.sink) {
    // sink may be "fetch('https://evil.com/x')" — extract host.
    const m = f.sink.match(/https?:\/\/([a-zA-Z0-9.-]+)/)
    if (m) out.add(normalizeAllowlistDomain(m[1]))
  }
  return Array.from(out).filter(Boolean)
}

function compactFinding(f: Finding) {
  return {
    findingId: f.findingId,
    signalClass: f.signalClass,
    severity: f.severity,
    targetFile: f.targetFile,
    anchor: f.evidence[0]?.anchor,
    sink: f.sink,
    remoteUrl: f.remoteUrl,
    flowPath: f.flowPath,
    domains: extractFindingDomains(f),
  }
}

export interface DedupeStageResult {
  dedupe: DedupeOutput
  knownManifest: KnownFindingsManifest
}

export async function runDedupe(
  ctx: StageContext,
  findings: MergedFindingsFile,
  runId: string,
): Promise<DedupeStageResult> {
  const known = loadKnownFindings(ctx.storeId)
  let suppressions: { allowlistedDomains: Set<string>; dismissedIssueIds: Set<string> } = {
    allowlistedDomains: new Set(),
    dismissedIssueIds: new Set(),
  }
  try {
    suppressions = await loadStoreSuppressions(ctx.storeId)
  } catch (err) {
    // DB unavailable (e.g. standalone dev-script run without DATABASE_URL).
    // Fail soft: no suppressions, pipeline still runs; production logs the error.
    logError("[detection-pipeline] loadStoreSuppressions failed; proceeding with none", {
      storeId: ctx.storeId,
      error: err instanceof Error ? err.message : String(err),
    })
  }

  // 1. Deterministic pre-filter: allowlisted domains → suppressed (never sent to judge).
  const verdicts: Verdict[] = []
  const toJudge: Finding[] = []
  for (const f of findings.findings) {
    const domains = extractFindingDomains(f)
    const suppressed = domains.some((d) => suppressions.allowlistedDomains.has(d))
    if (suppressed) {
      verdicts.push({
        findingId: f.findingId,
        verdict: "suppressed",
        matchedKnownId: null,
        rationale: `domain allowlisted: ${domains.join(", ")}`,
      })
    } else {
      toJudge.push(f)
    }
  }

  // 2. LLM judge for the rest.
  let judgeVerdicts: Verdict[] = []
  if (toJudge.length > 0) {
    const mcpServer = createOarmourMcpServer({
      storeId: ctx.storeId,
      version: ctx.version,
      runId: ctx.runId,
      runDir: ctx.runDir,
    })
    const prompt = [
      "# Task",
      "For each finding below, decide: new | better_example_of_known | duplicate_skip,",
      "relative to the known_findings manifest. Use the semantic fingerprint",
      "(signalClass + sink/domain + anchor/file). Return one verdict per finding via",
      "`mcp__oarmour__commit_stage_output` stage=\"dedupe\". Suppressed findings are already",
      "removed — do not re-derive them.",
      "",
      "## Findings to judge",
      "```json",
      JSON.stringify(toJudge.map(compactFinding), null, 2),
      "```",
      "",
      "## known_findings.json (cross-run memory)",
      "```json",
      JSON.stringify(known.findings, null, 2),
      "```",
    ].join("\n")

    const result = await runStageAgent({
      stage: "dedupe",
      systemPrompt: buildStageSystemPrompt("dedupe", ctx),
      prompt,
      mcpServer,
      runDir: ctx.runDir,
      modelId: ctx.modelId,
      maxTurns: 12,
    })

    const dedupePath = getPipelineStagePath(ctx.runDir, "dedupe")
    if (result.ok && fs.existsSync(dedupePath)) {
      try {
        const raw = JSON.parse(fs.readFileSync(dedupePath, "utf8"))
        const parsed = DedupeOutputSchema.safeParse(raw)
        if (parsed.success) judgeVerdicts = parsed.data.verdicts
        else logError("[detection-pipeline] dedupe output failed schema", { error: parsed.error.message })
      } catch (err) {
        logError("[detection-pipeline] dedupe parse failed", { error: err instanceof Error ? err.message : String(err) })
      }
    } else {
      logError("[detection-pipeline] dedupe agent did not commit; defaulting all to new", { error: result.error })
      judgeVerdicts = toJudge.map((f) => ({
        findingId: f.findingId,
        verdict: "new" as const,
        matchedKnownId: null,
        rationale: "judge unavailable; defaulted to new",
      }))
    }
  }

  const allVerdicts = [...verdicts, ...judgeVerdicts]
  const dedupe: DedupeOutput = { verdicts: allVerdicts }
  fs.writeFileSync(getPipelineStagePath(ctx.runDir, "dedupe"), JSON.stringify(dedupe, null, 2), "utf-8")

  // 3. Apply verdicts to known_findings (deterministic side-effect) + persist.
  const findingsById = new Map(findings.findings.map((f) => [f.findingId, f]))
  const updatedKnown = applyVerdictsToKnownFindings(known, allVerdicts, findingsById, runId)
  saveKnownFindings(updatedKnown)

  logInfo("[detection-pipeline] dedupe done", {
    total: allVerdicts.length,
    suppressed: verdicts.length,
    judge: judgeVerdicts.length,
  })

  return { dedupe, knownManifest: updatedKnown }
}
