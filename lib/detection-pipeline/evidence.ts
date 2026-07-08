import "server-only"

import fs from "fs"
import path from "path"
import type { PipelineArtifact } from "./storage"

const FILE_EXTENSIONS = new Set([".js", ".mjs", ".cjs", ".json", ".html", ".ts"])
const MAX_TREE_ENTRIES = 300

export interface CandidateEvidence {
  storeId: string
  version: string
  runId?: string
  /** Absolute root the find agent's `Read`/`Glob`/`Grep` operate against (cwd is runDir). */
  unpackRoot: string
  manifestSummary: Record<string, unknown>
  fileTree: Array<{ path: string; bytes: number }>
  apexDomains: Array<Record<string, unknown>>
  domainProvenance: Record<string, unknown>
  runtimeDomains?: Array<Record<string, unknown>>
  candidateDomains?: string[]
  source: "static" | "runtime" | "general"
}

function readJsonIfExists(p: string): unknown | null {
  if (!fs.existsSync(p)) return null
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"))
  } catch {
    return null
  }
}

function summarizeManifest(manifest: Record<string, unknown> | null): Record<string, unknown> {
  if (!manifest) return { error: "manifest.json not found in unpacked source" }
  const pick = (key: string) => (manifest[key] !== undefined ? { [key]: manifest[key] } : {})
  return {
    manifest_version: manifest.manifest_version,
    name: manifest.name,
    description: manifest.description,
    version: manifest.version,
    permissions: manifest.permissions,
    optional_permissions: manifest.optional_permissions,
    host_permissions: manifest.host_permissions,
    content_security_policy: manifest.content_security_policy,
    externally_connectable: manifest.externally_connectable,
    web_accessible_resources: manifest.web_accessible_resources,
    content_scripts: manifest.content_scripts,
    background: manifest.background,
    ...pick("icons"),
  }
}

function buildFileTree(unpackRoot: string): Array<{ path: string; bytes: number }> {
  const out: Array<{ path: string; bytes: number }> = []
  if (!fs.existsSync(unpackRoot)) return out
  const walk = (dir: string) => {
    if (out.length >= MAX_TREE_ENTRIES) return
    let entries
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const e of entries) {
      if (out.length >= MAX_TREE_ENTRIES) return
      if (e.name.startsWith(".git")) continue
      const full = path.join(dir, e.name)
      if (e.isDirectory()) {
        walk(full)
      } else if (FILE_EXTENSIONS.has(path.extname(e.name))) {
        try {
          out.push({ path: path.relative(unpackRoot, full), bytes: fs.statSync(full).size })
        } catch {
          // skip unreadable
        }
      }
    }
  }
  walk(unpackRoot)
  out.sort((a, b) => a.path.localeCompare(b.path))
  return out
}

/**
 * Deterministically gather the recon/find context from the filesystem sidecar +
 * unpacked source. Pure fs, no DB — `apexdomain_list.json` already carries the
 * WHOIS/VT enrichment per apex domain.
 *
 * `candidateDomains` present → domain-incremental mode (filter to those domains).
 * `candidateDomains` absent → general source-scan mode (full surface).
 */
export function loadCandidateEvidence(
  artifact: PipelineArtifact,
  opts: { candidateDomains?: string[]; source?: "static" | "runtime" | "general"; runId?: string },
): CandidateEvidence {
  const manifestPath = path.join(artifact.unpackRoot, "manifest.json")
  const manifestRaw = readJsonIfExists(manifestPath) as Record<string, unknown> | null

  const apexList = (readJsonIfExists(path.join(artifact.analysisDir, "apexdomain_list.json")) ?? []) as Array<Record<string, unknown>>
  const provenance = (readJsonIfExists(path.join(artifact.analysisDir, "domain_provenance.json")) ?? {}) as Record<string, unknown>

  let runtimeDomains: Array<Record<string, unknown>> | undefined
  const runId = opts.runId ?? artifact.runId
  if (runId) {
    const rtPath = path.join(artifact.analysisDir, `ai_runtime_domains_${runId}.json`)
    const rt = readJsonIfExists(rtPath)
    if (Array.isArray(rt)) runtimeDomains = rt as Array<Record<string, unknown>>
    else if (rt && typeof rt === "object" && Array.isArray((rt as Record<string, unknown>).novelDomains)) {
      runtimeDomains = ((rt as Record<string, unknown>).novelDomains) as Array<Record<string, unknown>>
    }
  }

  const candidateDomains = opts.candidateDomains
  const filteredApex = candidateDomains && candidateDomains.length > 0
    ? apexList.filter((row) => {
        const d = String(row.apexDomain ?? "")
        return candidateDomains.some((c) => d === c || d.endsWith(`.${c}`) || c.endsWith(`.${d}`))
      })
    : apexList

  return {
    storeId: artifact.storeId,
    version: artifact.version,
    runId,
    unpackRoot: artifact.unpackRoot,
    manifestSummary: summarizeManifest(manifestRaw),
    fileTree: buildFileTree(artifact.unpackRoot),
    apexDomains: filteredApex,
    domainProvenance: provenance,
    runtimeDomains,
    candidateDomains,
    source: opts.source ?? (candidateDomains ? "static" : "general"),
  }
}

/** Format the evidence into a compact text block for the agent user prompt. */
export function formatEvidenceForPrompt(ev: CandidateEvidence): string {
  const parts: string[] = []
  parts.push(`# Target extension`)
  parts.push(`storeId: ${ev.storeId}`)
  parts.push(`version: ${ev.version}`)
  parts.push(`source mode: ${ev.source}`)
  parts.push(`unpack root (absolute, use with Read/Glob/Grep): ${ev.unpackRoot}`)
  if (ev.runId) parts.push(`ai_testing runId: ${ev.runId}`)
  if (ev.candidateDomains && ev.candidateDomains.length > 0) {
    parts.push(`candidate domains (incremental): ${ev.candidateDomains.join(", ")}`)
  }
  parts.push("")
  parts.push(`## manifest.json (summary)`)
  parts.push("```json")
  parts.push(JSON.stringify(ev.manifestSummary, null, 2))
  parts.push("```")
  parts.push("")
  parts.push(`## file tree (${ev.fileTree.length} entries${ev.fileTree.length >= MAX_TREE_ENTRIES ? ", truncated" : ""})`)
  parts.push(
    ev.fileTree
      .map((f) => `${f.bytes.toString().padStart(8)}  ${f.path}`)
      .join("\n") || "(none)",
  )
  parts.push("")
  if (ev.apexDomains.length > 0) {
    parts.push(`## apex domains + enrichment (${ev.apexDomains.length})`)
    parts.push("```json")
    parts.push(JSON.stringify(ev.apexDomains, null, 2))
    parts.push("```")
    parts.push("")
  }
  if (ev.runtimeDomains && ev.runtimeDomains.length > 0) {
    parts.push(`## runtime / novel domains (${ev.runtimeDomains.length})`)
    parts.push("```json")
    parts.push(JSON.stringify(ev.runtimeDomains, null, 2))
    parts.push("```")
    parts.push("")
  }
  const provenanceKeys = Object.keys(ev.domainProvenance)
  if (provenanceKeys.length > 0) {
    parts.push(`## domain provenance (${provenanceKeys.length} domains, summarized keys)`)
    parts.push("```json")
    parts.push(JSON.stringify(ev.domainProvenance, null, 2).slice(0, 20000))
    parts.push("```")
  }
  return parts.join("\n")
}
