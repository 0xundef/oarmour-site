import { z } from "zod"

/**
 * Cross-stage JSON contracts for the detection pipeline. These schemas are the
 * handoff between stages AND the input schema for the `commit_stage_output` tool
 * (the agent's only structured-output exit). zod v3 — the same `zod` instance the
 * Claude Agent SDK resolves at runtime (verified compatible).
 */

export const SignalClassSchema = z.enum([
  // --- generic chrome-ext-audit classes ---
  "permissions",
  "dataflow",
  "remote-code",
  "messaging",
  "dom-injection",
  "privacy",
  "supply-chain",
  // --- wallet-ext-audit layer (crypto-wallet / web3 targets) ---
  "secret-exposure",
  "clickjacking",
  "signing-trust",
  "signature-phishing",
  "clipboard-swap",
  "tx-tampering",
  "impersonation",
  "session-theft",
])
export type SignalClass = z.infer<typeof SignalClassSchema>

export const SeveritySchema = z.enum(["CRITICAL", "HIGH", "MEDIUM", "LOW"])
export type Severity = z.infer<typeof SeveritySchema>

export const SourceFidelitySchema = z.enum([
  "sourcemap",
  "unpacked",
  "recovered",
  "beautified",
  "raw",
])
export type SourceFidelity = z.infer<typeof SourceFidelitySchema>

export const AnchorTypeSchema = z.enum([
  "string-literal",
  "chrome-api",
  "webpack-module",
])

export const EvidenceSchema = z.object({
  kind: z.literal("source_anchor"),
  file: z.string().min(1),
  anchor: z.string().min(1),
  anchorType: AnchorTypeSchema,
  snippet: z.string(),
  /** Optional domain context (for dataflow/supply-chain findings). */
  domain: z.string().optional(),
  detail: z.string().optional(),
})
export type Evidence = z.infer<typeof EvidenceSchema>

/**
 * A finding as the find agent produces it. `findingId` is OPTIONAL here — the
 * `commit_stage_output` tool fills it as `dp:<storeId>:<signalClass>:<anchorHash>`.
 */
export const FindingInputSchema = z.object({
  signalClass: SignalClassSchema,
  severity: SeveritySchema,
  sourceFidelity: SourceFidelitySchema,
  needsManualConfirmation: z.boolean(),
  confidence: z.enum(["high", "medium", "low"]).optional(),
  partitionId: z.string(),
  targetFile: z.string().min(1),
  evidence: z.array(EvidenceSchema).min(1),
  sink: z.string().optional(),
  flowPath: z.array(z.string()).optional(),
  remoteUrl: z.string().optional(),
  messagingSurface: z.string().optional(),
  reachability: z.string(),
  pocSummary: z.string(),
  remediation: z.string().optional(),
  notes: z.string().optional(),
})
export type FindingInput = z.infer<typeof FindingInputSchema>

/** A finding as stored on disk (findingId assigned). */
export const FindingSchema = FindingInputSchema.extend({
  findingId: z.string().min(1),
})
export type Finding = z.infer<typeof FindingSchema>

// --- Recon ---

export const PartitionSchema = z.object({
  id: z.string().min(1),
  label: z.string(),
  component: z.string().optional(),
  // Hard cap so a find agent can actually audit every file within its turn
  // budget (~2 tool calls/file + 1 commit). recon MUST split further if a
  // component has more files. Enforced at commit time.
  targetFiles: z.array(z.string()).min(1).max(8),
  candidateSignalClasses: z.array(SignalClassSchema),
  candidateDomains: z.array(z.string()).optional(),
  rationale: z.string(),
})
export type Partition = z.infer<typeof PartitionSchema>

export const DroppedClusterSchema = z.object({
  kind: z.enum(["domain", "component"]),
  items: z.array(z.string()),
  reason: z.string(),
})

export const ReconOutputSchema = z.object({
  partitions: z.array(PartitionSchema).min(1),
  droppedClusters: z.array(DroppedClusterSchema).default([]),
  manifestRiskPreview: z.string(),
  trustBoundaries: z.array(z.string()).default([]),
})
export type ReconOutput = z.infer<typeof ReconOutputSchema>

// --- Findings ---

/**
 * Per-partition audit coverage attestation. Required so a "clean" partition is
 * never silently trusted: the find agent declares what it actually inspected.
 * `complete: false` means it ran out of budget before auditing every targetFile
 * for every tagged class — downstream must treat any "clean" result there as
 * UNVERIFIED, not as "no findings".
 */
export const FindingsCoverageSchema = z.object({
  inspectedFiles: z.array(z.string()).default([]),
  skippedFiles: z.array(z.string()).default([]),
  classesApplied: z.array(SignalClassSchema).default([]),
  complete: z.boolean().default(false),
  notes: z.string().optional(),
})
export type FindingsCoverage = z.infer<typeof FindingsCoverageSchema>

export const FindingsFileSchema = z.object({
  partitionId: z.string().min(1),
  sourceFidelity: SourceFidelitySchema,
  findings: z.array(FindingInputSchema),
  coverage: FindingsCoverageSchema.optional(),
  notes: z.string().optional(),
})
export type FindingsFile = z.infer<typeof FindingsFileSchema>

/** Aggregated coverage across all partitions (computed by the find stage). */
export const MergedCoverageSchema = z.object({
  totalPartitions: z.number().int(),
  auditedPartitions: z.number().int(),
  incompletePartitions: z.number().int(),
  missingCoveragePartitions: z.array(z.string()).default([]),
  inspectedFileCount: z.number().int(),
  skippedFileCount: z.number().int(),
})
export type MergedCoverage = z.infer<typeof MergedCoverageSchema>

/** Merged on-disk findings file (findingId assigned, all partitions). */
export const MergedFindingsFileSchema = z.object({
  partitionsProcessed: z.array(z.string()),
  sourceFidelity: SourceFidelitySchema,
  findings: z.array(FindingSchema),
  coverage: MergedCoverageSchema,
})
export type MergedFindingsFile = z.infer<typeof MergedFindingsFileSchema>

// --- Dedupe ---

export const VerdictSchema = z.object({
  findingId: z.string().min(1),
  verdict: z.enum(["new", "better_example_of_known", "duplicate_skip", "suppressed"]),
  matchedKnownId: z.string().nullable().default(null),
  rationale: z.string(),
})
export type Verdict = z.infer<typeof VerdictSchema>

export const DedupeOutputSchema = z.object({
  verdicts: z.array(VerdictSchema),
})
export type DedupeOutput = z.infer<typeof DedupeOutputSchema>

// --- Report ---

export const ReportFindingSchema = z.object({
  findingId: z.string().min(1),
  signalClass: SignalClassSchema,
  severity: SeveritySchema,
  sourceFidelity: SourceFidelitySchema,
  needsManualConfirmation: z.boolean(),
  class: z.string(),
  reachability: z.string(),
  escalationPath: z.string(),
  remediation: z.string(),
  narrative: z.string(),
})
export type ReportFinding = z.infer<typeof ReportFindingSchema>

export const ReportSummarySchema = z.object({
  total: z.number().int(),
  bySeverity: z.object({
    CRITICAL: z.number().int(),
    HIGH: z.number().int(),
    MEDIUM: z.number().int(),
    LOW: z.number().int(),
  }),
  newCount: z.number().int(),
  needsManualConfirmationCount: z.number().int(),
  overall: z.string(),
})

export const ReportOutputSchema = z.object({
  summary: ReportSummarySchema,
  findings: z.array(ReportFindingSchema),
})
export type ReportOutput = z.infer<typeof ReportOutputSchema>

// --- known_findings.json (cross-run memory) ---

export const KnownFindingSchema = z.object({
  findingId: z.string().min(1),
  signalClass: SignalClassSchema,
  severity: SeveritySchema,
  domain: z.string().optional(),
  firstSeenRun: z.string(),
  lastSeenRun: z.string(),
  status: z.enum(["active", "resolved"]).default("active"),
  bestEvidenceRef: z.string(),
})
export type KnownFinding = z.infer<typeof KnownFindingSchema>

export const KnownFindingsManifestSchema = z.object({
  storeId: z.string(),
  version: z.string().optional(),
  updatedAt: z.string(),
  findings: z.array(KnownFindingSchema).default([]),
})
export type KnownFindingsManifest = z.infer<typeof KnownFindingsManifestSchema>

// --- Run manifest ---

export const StageStatusSchema = z.object({
  status: z.enum(["pending", "running", "completed", "failed", "skipped"]),
  file: z.string().optional(),
  startedAt: z.string().optional(),
  finishedAt: z.string().optional(),
  error: z.string().optional(),
})

export const RunManifestSchema = z.object({
  runId: z.string(),
  storeId: z.string(),
  version: z.string(),
  source: z.enum(["static", "runtime", "general"]).default("general"),
  aiTestingRunId: z.string().nullable().default(null),
  candidateDomains: z.array(z.string()).default([]),
  candidateHash: z.string().optional(),
  threatModelRef: z.string(),
  sourceFidelity: SourceFidelitySchema.default("raw"),
  modelId: z.string(),
  stages: z.object({
    recon: StageStatusSchema,
    find: StageStatusSchema,
    dedupe: StageStatusSchema,
    report: StageStatusSchema,
  }),
  startedAt: z.string(),
  finishedAt: z.string().nullable().default(null),
})
export type RunManifest = z.infer<typeof RunManifestSchema>

/** Maps a stage name to its payload schema for `commit_stage_output`. */
export const STAGE_PAYLOAD_SCHEMAS = {
  recon: ReconOutputSchema,
  findings: FindingsFileSchema,
  dedupe: DedupeOutputSchema,
  report: ReportOutputSchema,
} as const
export type StageName = keyof typeof STAGE_PAYLOAD_SCHEMAS

/** Stage keys used in the run manifest (short form: `find`, not `findings`). */
export type ManifestStageName = "recon" | "find" | "dedupe" | "report"
