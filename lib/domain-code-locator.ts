import fs from "fs"
import path from "path"
import { apexFromUrlOrHost, normalizeApexDomain } from "@/lib/domain-normalize"
import {
  resolveIssueExtensionArtifact,
  type IssueExtensionArtifactContext,
} from "@/lib/issue-extension-artifact"
import { listAiTestingRunsWithRecordings } from "@/lib/extension-storage"

const MAX_FILE_BYTES = 512_000
const MAX_FILES_TO_SCAN = 24
const MAX_OCCURRENCES_TOTAL = 24
const MAX_OCCURRENCES_PER_FILE = 6
const CONTEXT_LINE_COUNT = 4

const SCANNABLE_EXTENSIONS = new Set([
  ".js",
  ".mjs",
  ".cjs",
  ".ts",
  ".tsx",
  ".jsx",
  ".json",
  ".html",
  ".htm",
  ".css",
  ".xml",
  ".svg",
  ".txt",
  ".md",
  ".vue",
  ".map",
])

export type DomainCodeOccurrence = {
  file: string
  line: number
  column: number
  before: string[]
  lineText: string
  after: string[]
}

export type LocateDomainInSourceResult = {
  domain: string
  apexDomain: string
  extensionVersion: string | null
  hintFiles: string[]
  scannedFiles: string[]
  occurrences: DomainCodeOccurrence[]
  notes: string[]
}

function loadHintFilesByApex(artifact: IssueExtensionArtifactContext): Record<string, string[]> {
  const apexListPath = path.join(artifact.analysisDir, "apexdomain_list.json")
  if (!fs.existsSync(apexListPath)) return {}
  try {
    const raw = JSON.parse(fs.readFileSync(apexListPath, "utf8")) as unknown
    if (!Array.isArray(raw)) return {}
    const map: Record<string, string[]> = {}
    for (const row of raw) {
      if (!row || typeof row !== "object") continue
      const obj = row as Record<string, unknown>
      const apex = typeof obj.apexDomain === "string" ? normalizeApexDomain(obj.apexDomain) : ""
      const filesRaw = obj.sourceFiles
      if (!apex) continue
      const files = Array.isArray(filesRaw)
        ? filesRaw.filter((f): f is string => typeof f === "string" && f.trim().length > 0)
        : []
      if (files.length > 0) map[apex] = files.map((f) => f.replace(/\\/g, "/"))
    }
    return map
  } catch {
    return {}
  }
}

function buildSearchTerms(domainInput: string): string[] {
  const trimmed = domainInput.trim()
  const apex = apexFromUrlOrHost(trimmed) ?? normalizeApexDomain(trimmed)
  const terms = new Set<string>()
  if (trimmed) terms.add(trimmed.toLowerCase())
  if (apex) {
    terms.add(apex)
    if (!trimmed.includes(".") && apex.includes(".")) {
      terms.add(apex.split(".").slice(-2).join("."))
    }
  }
  return Array.from(terms).filter((t) => t.length >= 3)
}

function isPathInsideRoot(root: string, candidate: string): boolean {
  const resolvedRoot = path.resolve(root)
  const resolved = path.resolve(candidate)
  return resolved === resolvedRoot || resolved.startsWith(`${resolvedRoot}${path.sep}`)
}

function resolveReadableFile(
  artifact: IssueExtensionArtifactContext,
  relativePath: string,
): string | null {
  const normalized = relativePath.replace(/\\/g, "/").replace(/^\/+/, "")
  if (!normalized || normalized.includes("..")) return null

  if (normalized === "network.json") {
    const runs = listAiTestingRunsWithRecordings(artifact.storeId, artifact.version)
    const latest = runs[0]
    if (!latest) return null
    const networkPath = path.join(latest.runRoot, "network.json")
    return fs.existsSync(networkPath) ? networkPath : null
  }

  const extensionCandidate = path.join(artifact.extensionRoot, normalized)
  if (fs.existsSync(extensionCandidate)) {
    return isPathInsideRoot(artifact.extensionRoot, extensionCandidate) ? extensionCandidate : null
  }

  const sidecarCandidate = path.join(artifact.sidecarRoot, normalized)
  if (fs.existsSync(sidecarCandidate)) {
    return isPathInsideRoot(artifact.sidecarRoot, sidecarCandidate) ? sidecarCandidate : null
  }

  return null
}

function discoverFallbackFiles(artifact: IssueExtensionArtifactContext): string[] {
  const root = artifact.extensionRoot
  if (!fs.existsSync(root)) return []

  const found: string[] = []
  const queue: string[] = [root]

  while (queue.length > 0 && found.length < MAX_FILES_TO_SCAN) {
    const dir = queue.shift()!
    let entries: fs.Dirent[]
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      continue
    }
    for (const entry of entries) {
      if (found.length >= MAX_FILES_TO_SCAN) break
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        if (entry.name === "node_modules" || entry.name === "_metadata") continue
        queue.push(full)
        continue
      }
      const ext = path.extname(entry.name).toLowerCase()
      if (!SCANNABLE_EXTENSIONS.has(ext)) continue
      const rel = path.relative(artifact.extensionRoot, full).replace(/\\/g, "/")
      found.push(rel)
    }
  }

  return found
}

function findOccurrencesInFile(params: {
  absolutePath: string
  displayPath: string
  terms: string[]
}): DomainCodeOccurrence[] {
  const { absolutePath, displayPath, terms } = params
  let stat: fs.Stats
  try {
    stat = fs.statSync(absolutePath)
  } catch {
    return []
  }
  if (!stat.isFile() || stat.size > MAX_FILE_BYTES) return []

  let content: string
  try {
    content = fs.readFileSync(absolutePath, "utf8")
  } catch {
    return []
  }
  if (content.includes("\u0000")) return []

  const lines = content.split(/\r?\n/)
  const hits: DomainCodeOccurrence[] = []

  for (let i = 0; i < lines.length; i++) {
    if (hits.length >= MAX_OCCURRENCES_PER_FILE) break
    const lineText = lines[i] ?? ""
    const lower = lineText.toLowerCase()
    const matchedTerm = terms.find((term) => lower.includes(term))
    if (!matchedTerm) continue

    const column = Math.max(0, lower.indexOf(matchedTerm))
    const beforeStart = Math.max(0, i - CONTEXT_LINE_COUNT)
    const afterEnd = Math.min(lines.length, i + CONTEXT_LINE_COUNT + 1)
    hits.push({
      file: displayPath,
      line: i + 1,
      column: column + 1,
      before: lines.slice(beforeStart, i),
      lineText,
      after: lines.slice(i + 1, afterEnd),
    })
  }

  return hits
}

export async function locateDomainInSource(params: {
  storeId: string
  domain: string
  maxFiles?: number
}): Promise<LocateDomainInSourceResult> {
  const terms = buildSearchTerms(params.domain)
  const apexDomain = apexFromUrlOrHost(params.domain) ?? normalizeApexDomain(params.domain)
  const notes: string[] = []

  if (terms.length === 0) {
    return {
      domain: params.domain,
      apexDomain: apexDomain || params.domain,
      extensionVersion: null,
      hintFiles: [],
      scannedFiles: [],
      occurrences: [],
      notes: ["Could not parse a searchable domain from the input."],
    }
  }

  const artifact = await resolveIssueExtensionArtifact(params.storeId)
  if (!artifact) {
    return {
      domain: params.domain,
      apexDomain: apexDomain || params.domain,
      extensionVersion: null,
      hintFiles: [],
      scannedFiles: [],
      occurrences: [],
      notes: ["Extension package or version is not available on this server."],
    }
  }

  if (!fs.existsSync(artifact.extensionRoot)) {
    notes.push("Unpacked extension directory is missing; only sidecar artifacts may be available.")
  }

  const hintMap = loadHintFilesByApex(artifact)
  const hintFiles = apexDomain ? (hintMap[apexDomain] ?? []) : []
  const candidateFiles = new Set<string>(hintFiles)

  if (listAiTestingRunsWithRecordings(artifact.storeId, artifact.version).length > 0) {
    candidateFiles.add("network.json")
  }
  candidateFiles.add("manifest.json")

  if (candidateFiles.size < 3 && fs.existsSync(artifact.extensionRoot)) {
    for (const rel of discoverFallbackFiles(artifact)) {
      candidateFiles.add(rel)
      if (candidateFiles.size >= (params.maxFiles ?? MAX_FILES_TO_SCAN)) break
    }
  }

  const fileList = Array.from(candidateFiles).slice(0, params.maxFiles ?? MAX_FILES_TO_SCAN)
  const scannedFiles: string[] = []
  const occurrences: DomainCodeOccurrence[] = []

  for (const rel of fileList) {
    if (occurrences.length >= MAX_OCCURRENCES_TOTAL) break
    const absolute = resolveReadableFile(artifact, rel)
    if (!absolute) {
      notes.push(`Hint file not readable: ${rel}`)
      continue
    }
    scannedFiles.push(rel)
    const fileHits = findOccurrencesInFile({
      absolutePath: absolute,
      displayPath: rel,
      terms,
    })
    occurrences.push(...fileHits)
  }

  if (occurrences.length === 0) {
    notes.push(
      "No literal domain matches in scanned files. The domain may appear only at runtime, under minified names, or in a file outside the scan set.",
    )
  }

  return {
    domain: params.domain,
    apexDomain: apexDomain || params.domain,
    extensionVersion: artifact.version,
    hintFiles,
    scannedFiles,
    occurrences: occurrences.slice(0, MAX_OCCURRENCES_TOTAL),
    notes,
  }
}
