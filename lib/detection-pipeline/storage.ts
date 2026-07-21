import fs from "fs"
import path from "path"
import {
  getAgentQueueRoot,
  getExtensionAnalysisDir,
  getExtensionArtifactRoot,
  getAiTestingRunRoot,
} from "@/lib/extension-storage"
import { type StageName, RunManifestSchema, type RunManifest } from "./schemas"

const PIPELINE_RUNS_DIR = "pipeline-runs"

/** `<AGENT_QUEUE_ROOT>/pipeline-runs` */
export function getPipelineRunsRoot() {
  return path.join(getAgentQueueRoot(), PIPELINE_RUNS_DIR)
}

/** `<AGENT_QUEUE_ROOT>/pipeline-runs/<storeId>` */
export function getPipelineStoreDir(storeId: string) {
  return path.join(getPipelineRunsRoot(), storeId)
}

/** `<AGENT_QUEUE_ROOT>/pipeline-runs/<storeId>/<runId>` */
export function getPipelineRunDir(storeId: string, runId: string) {
  return path.join(getPipelineStoreDir(storeId), runId)
}

const STAGE_FILES: Record<StageName, string> = {
  recon: "01-recon.json",
  findings: "02-findings.json",
  dedupe: "03-dedupe.json",
  report: "04-report.json",
}

export function getPipelineStagePath(runDir: string, stage: StageName) {
  return path.join(runDir, STAGE_FILES[stage])
}

/** Per-partition find output, merged into `02-findings.json` by the orchestrator. */
export function getFindingsPartitionPath(runDir: string, partitionId: string) {
  const safe = partitionId.replace(/[^a-zA-Z0-9_-]/g, "_")
  return path.join(runDir, `02-findings.${safe}.json`)
}

export function getReportPath(runDir: string) {
  return path.join(runDir, "report.md")
}

export function getAgentLogPath(runDir: string) {
  return path.join(runDir, "agent.log")
}

export function getManifestPath(runDir: string) {
  return path.join(runDir, "manifest.json")
}

/** Store-scoped cross-run dedup memory: `pipeline-runs/<storeId>/known_findings.json`. */
export function getKnownFindingsPath(storeId: string) {
  return path.join(getPipelineStoreDir(storeId), "known_findings.json")
}

export interface PipelineArtifact {
  storeId: string
  version: string
  unpackRoot: string
  analysisDir: string
  sidecarRoot: string
  aiTestingRunRoot: string | null
  runId?: string
}

/** Resolve the filesystem artifact for a target extension version. Pure fs, no DB. */
export function resolvePipelineArtifact(
  storeId: string,
  version: string,
  runId?: string,
): PipelineArtifact {
  const unpackRoot = getExtensionArtifactRoot(storeId, version)
  const analysisDir = getExtensionAnalysisDir(storeId, version)
  const sidecarRoot = path.join(getAgentQueueRoot(), "extension-data", storeId, version)
  const aiTestingRunRoot = runId ? getAiTestingRunRoot(storeId, version, runId) : null
  return { storeId, version, unpackRoot, analysisDir, sidecarRoot, aiTestingRunRoot, runId }
}

/** Build a run id: `<timestamp>[-<runId>]`. */
export function buildRunId(runIdSuffix?: string) {
  const ts = new Date().toISOString().replace(/[:.]/g, "-")
  return runIdSuffix ? `${ts}-${runIdSuffix}` : ts
}

export function ensureRunDir(storeId: string, runId: string) {
  const runDir = getPipelineRunDir(storeId, runId)
  fs.mkdirSync(runDir, { recursive: true })
  fs.mkdirSync(getPipelineStoreDir(storeId), { recursive: true })
  return runDir
}

/** List per-partition find files written under a run dir. */
export function listFindingsPartitionPaths(runDir: string): string[] {
  if (!fs.existsSync(runDir)) return []
  return fs
    .readdirSync(runDir)
    .filter((f) => /^02-findings\..*\.json$/.test(f))
    .map((f) => path.join(runDir, f))
    .sort()
}

export interface PipelineRunSummary {
  runId: string
  runDir: string
  manifest: RunManifest
}

/** List all pipeline runs for a store, newest-first by manifest.startedAt. */
export function listPipelineRuns(storeId: string): PipelineRunSummary[] {
  const storeDir = getPipelineStoreDir(storeId)
  if (!fs.existsSync(storeDir)) return []
  const runs: PipelineRunSummary[] = []
  for (const entry of fs.readdirSync(storeDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const runDir = path.join(storeDir, entry.name)
    const manifestPath = getManifestPath(runDir)
    if (!fs.existsSync(manifestPath)) continue
    try {
      const raw = JSON.parse(fs.readFileSync(manifestPath, "utf8"))
      const parsed = RunManifestSchema.safeParse(raw)
      if (!parsed.success) continue
      runs.push({ runId: entry.name, runDir, manifest: parsed.data })
    } catch {
      continue
    }
  }
  return runs.sort((a, b) =>
    (b.manifest.startedAt ?? "").localeCompare(a.manifest.startedAt ?? ""),
  )
}

/** Newest completed run (report stage completed) for a store, or the newest run, or null. */
export function getLatestPipelineRun(storeId: string): PipelineRunSummary | null {
  const runs = listPipelineRuns(storeId)
  return runs.find((r) => r.manifest.stages.report?.status === "completed") ?? runs[0] ?? null
}

/** Read the latest run's report.md + metadata for a store, or null if none/none-yet. */
export function readPipelineReportMarkdown(storeId: string): {
  runId: string
  startedAt: string
  finishedAt: string | null
  sourceFidelity: string
  markdown: string
} | null {
  const latest = getLatestPipelineRun(storeId)
  if (!latest) return null
  const reportPath = getReportPath(latest.runDir)
  if (!fs.existsSync(reportPath)) return null
  const markdown = fs.readFileSync(reportPath, "utf8")
  return {
    runId: latest.runId,
    startedAt: latest.manifest.startedAt,
    finishedAt: latest.manifest.finishedAt,
    sourceFidelity: latest.manifest.sourceFidelity,
    markdown,
  }
}

/**
 * A healthy pipeline finishes in minutes (recon/find/dedupe/report, each
 * turn-bounded). A run still non-terminal past this threshold was killed
 * mid-stage (process restart / OOM / hard crash) before the orchestrator's
 * catch block could mark the stage failed — so the manifest is stuck on
 * "running"/"pending" forever. We treat such runs as failed so the UI stops
 * spinning and the user can re-trigger.
 */
const STALE_RUN_MS = 30 * 60 * 1000 // 30 min

/** Latest run's pollable state for the UI. status: running|completed|failed. */
export function getLatestPipelineRunState(storeId: string): {
  runId: string
  startedAt: string
  finishedAt: string | null
  sourceFidelity: string
  status: "running" | "completed" | "failed"
  /** True when status was flipped to "failed" because the run stalled (non-terminal past STALE_RUN_MS). */
  stale: boolean
  markdown: string | null
} | null {
  const latest = getLatestPipelineRun(storeId)
  if (!latest) return null
  const stages = latest.manifest.stages
  let status: "running" | "completed" | "failed" = "running"
  let stale = false
  if (stages.report?.status === "completed") {
    status = "completed"
  } else if (
    stages.recon?.status === "failed" ||
    stages.find?.status === "failed" ||
    stages.dedupe?.status === "failed" ||
    stages.report?.status === "failed"
  ) {
    status = "failed"
  } else {
    // Non-terminal, no explicit failure. Detect a stalled/dead run: a healthy
    // run finishes in minutes, so one still "running" past STALE_RUN_MS was
    // killed hard (the orchestrator never got to mark the stage failed).
    const startedMs = Date.parse(latest.manifest.startedAt ?? "")
    if (Number.isFinite(startedMs) && Date.now() - startedMs > STALE_RUN_MS) {
      status = "failed"
      stale = true
    }
  }
  let markdown: string | null = null
  if (status === "completed") {
    const reportPath = getReportPath(latest.runDir)
    if (fs.existsSync(reportPath)) markdown = fs.readFileSync(reportPath, "utf8")
  }
  return {
    runId: latest.runId,
    startedAt: latest.manifest.startedAt,
    finishedAt: latest.manifest.finishedAt,
    sourceFidelity: latest.manifest.sourceFidelity,
    status,
    stale,
    markdown,
  }
}
