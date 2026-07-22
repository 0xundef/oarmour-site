import "server-only"

import crypto from "crypto"
import fs from "fs"
import path from "path"
import { logError, logInfo } from "@/lib/app-logger"
import { loadThreatModel } from "./threat-model"
import { loadCandidateEvidence } from "./evidence"
import {
  buildRunId,
  ensureRunDir,
  getManifestPath,
  getPipelineRunDir,
  getReportPath,
  getPipelineStoreDir,
  resolvePipelineArtifact,
} from "./storage"
import { renderReportMarkdown } from "./report-writer"
import {
  RunManifestSchema,
  type RunManifest,
  type ManifestStageName,
} from "./schemas"
import { runRecon } from "./stages/recon"
import { runFind } from "./stages/find"
import { runDedupe } from "./stages/dedupe"
import { runReport } from "./stages/report"
import type { StageContext } from "./stages/context"

export interface RunDetectionPipelineParams {
  storeId: string
  version: string
  runId?: string
  candidateDomains?: string[]
  source?: "static" | "runtime" | "general"
  /** Force a specific run id (used by the background starter). Skips the in-flight guard. */
  runIdOverride?: string
  /** Skip the recent-run idempotency guard (used by the background starter). */
  skipIdempotency?: boolean
}

export interface RunDetectionPipelineResult {
  runDir: string
  runId: string
  manifest: RunManifest
}

function resolveModelId(): string {
  // Honors the `default` convention. (Informational — the per-stage model actually
  // used is resolved in agent.ts's resolveModelId(stage).)
  const v = process.env.DETECTION_PIPELINE_MODEL?.trim()
  return !v || v.toLowerCase() === "default" ? "claude-glm-5.2" : v
}

function candidateHash(params: RunDetectionPipelineParams): string {
  return crypto
    .createHash("sha1")
    .update(JSON.stringify({
      v: params.version,
      r: params.runId ?? null,
      d: params.candidateDomains ?? [],
      s: params.source ?? "general",
    }))
    .digest("hex")
    .slice(0, 12)
}

/** Lightweight in-flight/idempotency guard: skip if a young run with the same fingerprint exists. */
function findRecentRun(params: RunDetectionPipelineParams): string | null {
  const storeDir = getPipelineStoreDir(params.storeId)
  if (!fs.existsSync(storeDir)) return null
  const hash = candidateHash(params)
  const now = Date.now()
  const cutoff = 60_000 // 60s
  let recent: string | null = null
  for (const entry of fs.readdirSync(storeDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const runDir = path.join(storeDir, entry.name)
    const manifestPath = getManifestPath(runDir)
    if (!fs.existsSync(manifestPath)) continue
    try {
      const m = JSON.parse(fs.readFileSync(manifestPath, "utf8"))
      if (m.candidateHash !== hash) continue
      const started = Date.parse(m.startedAt ?? "")
      if (Number.isFinite(started) && now - started < cutoff) {
        recent = runDir
        break
      }
    } catch {
      // ignore
    }
  }
  return recent
}

function writeManifest(runDir: string, manifest: RunManifest) {
  fs.writeFileSync(getManifestPath(runDir), JSON.stringify(manifest, null, 2), "utf-8")
}

function newManifest(params: RunDetectionPipelineParams, runId: string, threatModelRef: string, modelId: string, hash: string): RunManifest {
  const startedAt = new Date().toISOString()
  const pending = { status: "pending" as const }
  return {
    runId,
    storeId: params.storeId,
    version: params.version,
    source: params.source ?? (params.candidateDomains ? "static" : "general"),
    aiTestingRunId: params.runId ?? null,
    candidateDomains: params.candidateDomains ?? [],
    candidateHash: hash,
    threatModelRef,
    sourceFidelity: "raw",
    modelId,
    stages: { recon: pending, find: pending, dedupe: pending, report: pending },
    startedAt,
    finishedAt: null,
  }
}

function markStage(manifest: RunManifest, stage: ManifestStageName, status: RunManifest["stages"][ManifestStageName]["status"], file?: string, error?: string) {
  const stageFileMap: Record<ManifestStageName, string> = {
    recon: "01-recon.json",
    find: "02-findings.json",
    dedupe: "03-dedupe.json",
    report: "04-report.json",
  }
  manifest.stages[stage] = {
    status,
    file: file ?? stageFileMap[stage],
    startedAt: manifest.stages[stage].startedAt ?? new Date().toISOString(),
    finishedAt: status === "completed" || status === "failed" ? new Date().toISOString() : undefined,
    error,
  }
}

/**
 * Deterministic stage-chaining orchestrator. Each stage is an LLM `query()`; JSON
 * files are the handoff contract between stages. Writes manifest.json throughout.
 */
export async function runDetectionPipeline(
  params: RunDetectionPipelineParams,
): Promise<RunDetectionPipelineResult> {
  const modelId = resolveModelId()
  const hash = candidateHash(params)

  // In-flight guard (skip when forced by the background starter).
  if (!params.skipIdempotency) {
    const recent = findRecentRun(params)
    if (recent) {
      logInfo("[detection-pipeline] skipping — recent identical run exists", { runDir: recent })
      const manifest = RunManifestSchema.parse(JSON.parse(fs.readFileSync(getManifestPath(recent), "utf8")))
      return { runDir: recent, runId: manifest.runId, manifest }
    }
  }

  const artifact = resolvePipelineArtifact(params.storeId, params.version, params.runId)
  const threatModel = loadThreatModel(params.storeId)
  const evidence = loadCandidateEvidence(artifact, {
    candidateDomains: params.candidateDomains,
    source: params.source,
    runId: params.runId,
  })

  const runId = params.runIdOverride ?? buildRunId(params.runId)
  const runDir = ensureRunDir(params.storeId, runId)

  let manifest = newManifest(params, runId, threatModel.ref, modelId, hash)
  writeManifest(runDir, manifest)

  const ctx: StageContext = {
    storeId: params.storeId,
    version: params.version,
    runId: params.runId,
    runDir,
    modelId,
    threatModelRef: threatModel.ref,
    threatModelBody: threatModel.body,
    artifact,
    evidence,
    source: manifest.source,
  }

  try {
    // 1. recon
    markStage(manifest, "recon", "running")
    writeManifest(runDir, manifest)
    const recon = await runRecon(ctx)
    markStage(manifest, "recon", "completed")
    writeManifest(runDir, manifest)

    // 2. find
    markStage(manifest, "find", "running")
    writeManifest(runDir, manifest)
    const findings = await runFind(ctx, recon)
    manifest.sourceFidelity = findings.sourceFidelity
    markStage(manifest, "find", "completed")
    writeManifest(runDir, manifest)

    // 3. dedupe
    markStage(manifest, "dedupe", "running")
    writeManifest(runDir, manifest)
    const { dedupe } = await runDedupe(ctx, findings, runId)
    markStage(manifest, "dedupe", "completed")
    writeManifest(runDir, manifest)

    // 4. report
    markStage(manifest, "report", "running")
    writeManifest(runDir, manifest)
    const report = await runReport(ctx, findings, dedupe)
    markStage(manifest, "report", "completed")
    writeManifest(runDir, manifest)

    // 5. render report.md (cached)
    fs.writeFileSync(
      getReportPath(runDir),
      renderReportMarkdown(report, { storeId: params.storeId, version: params.version, runId }, findings.coverage),
      "utf-8",
    )
  } catch (err) {
    logError("[detection-pipeline] run failed", {
      storeId: params.storeId,
      runId,
      error: err instanceof Error ? err.message : String(err),
    })
    // Mark any running stage as failed.
    for (const stage of ["recon", "find", "dedupe", "report"] as ManifestStageName[]) {
      if (manifest.stages[stage].status === "running") {
        markStage(manifest, stage, "failed", undefined, err instanceof Error ? err.message : String(err))
      }
    }
    manifest.finishedAt = new Date().toISOString()
    writeManifest(runDir, manifest)
    throw err
  }

  manifest.finishedAt = new Date().toISOString()
  writeManifest(runDir, manifest)
  logInfo("[detection-pipeline] run complete", {
    storeId: params.storeId,
    runId,
    runDir,
    findings: "(see 04-report.json)",
  })

  return { runDir: getPipelineRunDir(params.storeId, runId), runId, manifest }
}

/**
 * Kick off a pipeline run in the BACKGROUND (do not await). Computes the runId +
 * writes an initial "started" manifest so the run is immediately listable/pollable,
 * then launches `runDetectionPipeline` as a floating promise. Returns immediately
 * with { runId, runDir } so the HTTP trigger doesn't block for the (minutes-long) run.
 *
 * The pipeline runs in the Next.js server process (next start / pm2); the floating
 * promise keeps it alive after the response is sent. Client polls
 * GET /api/detection-pipeline/report?storeId= until the report stage completes.
 */
export function startDetectionPipelineBackground(
  params: RunDetectionPipelineParams,
): { runId: string; runDir: string } {
  const modelId = resolveModelId()
  const hash = candidateHash(params)
  const runId = buildRunId(params.runId)
  const runDir = ensureRunDir(params.storeId, runId)

  // Write an initial manifest so the run is visible immediately (stages = pending).
  const manifest = newManifest(params, runId, loadThreatModel(params.storeId).ref, modelId, hash)
  writeManifest(runDir, manifest)

  // Fire-and-forget. Errors are logged inside runDetectionPipeline.
  void runDetectionPipeline({ ...params, runIdOverride: runId, skipIdempotency: true })
    .catch((err) => {
      logError("[detection-pipeline] background run failed", {
        storeId: params.storeId,
        runId,
        error: err instanceof Error ? err.message : String(err),
      })
    })

  return { runId, runDir: getPipelineRunDir(params.storeId, runId) }
}
