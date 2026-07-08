import fs from "fs"
import path from "path"
import {
  getAgentQueueRoot,
  getExtensionAnalysisDir,
  getExtensionArtifactRoot,
  getAiTestingRunRoot,
} from "@/lib/extension-storage"
import type { StageName } from "./schemas"

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
