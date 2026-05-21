import fs from "fs"
import path from "path"
import { apexFromUrlOrHost, normalizeApexDomain } from "@/lib/domain-normalize"
import {
  resolveIssueExtensionArtifact,
  type IssueExtensionArtifactContext,
} from "@/lib/issue-extension-artifact"
import { listAiTestingRunsWithRecordings } from "@/lib/extension-storage"

const MAX_FILE_BYTES = 512_000
const MAX_FILES_TO_SCAN = 16
const MAX_OCCURRENCES_TOTAL = 12
const MAX_OCCURRENCES_PER_FILE = 4
/** Characters of source shown before / after each match (not lines). */
const CHARS_BEFORE = 120
const CHARS_AFTER = 120
const MAX_MATCH_CHARS = 160
const MAX_SNIPPET_CHARS = CHARS_BEFORE + MAX_MATCH_CHARS + CHARS_AFTER + 20

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
  matchedTerm: string
  snippet: string
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

/** Parse workbench `file` label into a relative path when possible. */
export function parseFindingFilePath(fileLabel: string): string | null {
  const trimmed = fileLabel.trim()
  if (!trimmed || trimmed.includes("extension package")) return null
  const main = trimmed.split(" (+")[0]?.trim() ?? ""
  if (!main || main.includes("(")) return null
  return main.replace(/\\/g, "/")
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

function relativePathVariants(relativePath: string): string[] {
  const normalized = relativePath.replace(/\\/g, "/").replace(/^\/+/, "")
  if (!normalized || normalized.includes("..")) return []

  const variants = new Set<string>([normalized])
  const parts = normalized.split("/")
  if (parts.length > 1) {
    variants.add(parts.slice(1).join("/"))
    variants.add(parts[parts.length - 1]!)
  }
  return Array.from(variants)
}

function tryResolveAtRoot(
  root: string,
  relativePath: string,
): string | null {
  const candidate = path.join(root, relativePath)
  if (!fs.existsSync(candidate)) return null
  return isPathInsideRoot(root, candidate) ? candidate : null
}

function findByBasename(
  artifact: IssueExtensionArtifactContext,
  basename: string,
): { absolutePath: string; displayPath: string } | null {
  const root = artifact.extensionRoot
  if (!fs.existsSync(root) || !basename) return null

  const queue: string[] = [root]
  let scanned = 0
  const maxDirs = 80

  while (queue.length > 0 && scanned < maxDirs) {
    const dir = queue.shift()!
    scanned++
    let entries: fs.Dirent[]
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      continue
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        if (entry.name === "node_modules" || entry.name === "_metadata") continue
        queue.push(full)
        continue
      }
      if (entry.name === basename) {
        const displayPath = path.relative(root, full).replace(/\\/g, "/")
        return { absolutePath: full, displayPath }
      }
    }
  }
  return null
}

function resolveReadableFile(
  artifact: IssueExtensionArtifactContext,
  relativePath: string,
): { absolutePath: string; displayPath: string } | null {
  const normalized = relativePath.replace(/\\/g, "/").replace(/^\/+/, "")
  if (!normalized || normalized.includes("..")) return null

  if (normalized === "network.json") {
    const runs = listAiTestingRunsWithRecordings(artifact.storeId, artifact.version)
    const latest = runs[0]
    if (!latest) return null
    const networkPath = path.join(latest.runRoot, "network.json")
    return fs.existsSync(networkPath)
      ? { absolutePath: networkPath, displayPath: "network.json" }
      : null
  }

  for (const variant of relativePathVariants(normalized)) {
    const ext = tryResolveAtRoot(artifact.extensionRoot, variant)
    if (ext) return { absolutePath: ext, displayPath: normalized }
    const side = tryResolveAtRoot(artifact.sidecarRoot, variant)
    if (side) return { absolutePath: side, displayPath: normalized }
  }

  const basename = path.posix.basename(normalized)
  return findByBasename(artifact, basename)
}

function lineColumnAt(content: string, index: number): { line: number; column: number } {
  const before = content.slice(0, index)
  const line = (before.match(/\n/g)?.length ?? 0) + 1
  const lastNl = before.lastIndexOf("\n")
  const column = index - (lastNl === -1 ? -1 : lastNl)
  return { line, column }
}

function buildSnippet(
  content: string,
  matchStart: number,
  matchEnd: number,
): string {
  const sliceStart = Math.max(0, matchStart - CHARS_BEFORE)
  const sliceEnd = Math.min(content.length, matchEnd + CHARS_AFTER)
  let before = content.slice(sliceStart, matchStart)
  let match = content.slice(matchStart, matchEnd)
  let after = content.slice(matchEnd, sliceEnd)
  if (match.length > MAX_MATCH_CHARS) {
    match = `${match.slice(0, MAX_MATCH_CHARS)}…`
  }
  let snippet = before + match + after
  if (snippet.length > MAX_SNIPPET_CHARS) {
    snippet = `${snippet.slice(0, MAX_SNIPPET_CHARS)}…`
  }
  return snippet.replace(/\r/g, "")
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

  const lower = content.toLowerCase()
  const hits: DomainCodeOccurrence[] = []
  const seen = new Set<number>()

  for (const term of terms) {
    const termLower = term.toLowerCase()
    let from = 0
    while (hits.length < MAX_OCCURRENCES_PER_FILE) {
      const idx = lower.indexOf(termLower, from)
      if (idx === -1) break
      if (!seen.has(idx)) {
        seen.add(idx)
        const matchEnd = idx + termLower.length
        const { line, column } = lineColumnAt(content, idx)
        hits.push({
          file: displayPath,
          line,
          column,
          matchedTerm: term,
          snippet: buildSnippet(content, idx, matchEnd),
        })
      }
      from = idx + Math.max(1, termLower.length)
    }
  }

  return hits.sort((a, b) => a.line - b.line || a.column - b.column)
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

function buildCandidateFileList(params: {
  artifact: IssueExtensionArtifactContext
  apexDomain: string
  priorityFilePaths: string[]
  maxFiles: number
}): string[] {
  const { artifact, apexDomain, priorityFilePaths, maxFiles } = params
  const hintMap = loadHintFilesByApex(artifact)
  const hintFiles = apexDomain ? (hintMap[apexDomain] ?? []) : []

  const ordered: string[] = []
  const seen = new Set<string>()
  const add = (rel: string) => {
    const n = rel.replace(/\\/g, "/").replace(/^\/+/, "")
    if (!n || seen.has(n)) return
    seen.add(n)
    ordered.push(n)
  }

  for (const p of priorityFilePaths) add(p)
  for (const p of hintFiles) add(p)
  if (fs.existsSync(path.join(artifact.extensionRoot, "manifest.json"))) {
    add("manifest.json")
  }
  if (listAiTestingRunsWithRecordings(artifact.storeId, artifact.version).length > 0) {
    add("network.json")
  }

  if (ordered.length < 4 && fs.existsSync(artifact.extensionRoot)) {
    for (const rel of discoverFallbackFiles(artifact)) {
      add(rel)
      if (ordered.length >= maxFiles) break
    }
  }

  return ordered.slice(0, maxFiles)
}

export async function locateDomainInSource(params: {
  storeId: string
  domain: string
  priorityFilePaths?: string[]
  maxFiles?: number
}): Promise<LocateDomainInSourceResult> {
  const terms = buildSearchTerms(params.domain)
  const apexDomain = apexFromUrlOrHost(params.domain) ?? normalizeApexDomain(params.domain)
  const notes: string[] = []
  const maxFiles = params.maxFiles ?? MAX_FILES_TO_SCAN
  const priorityFilePaths = (params.priorityFilePaths ?? [])
    .map((p) => p.replace(/\\/g, "/").replace(/^\/+/, ""))
    .filter(Boolean)

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
    notes.push(
      `Unpacked extension not found at ${artifact.extensionRoot}. Check EXTENSION_STORAGE_ROOT and that analysis has run for version ${artifact.version}.`,
    )
  }

  const hintMap = loadHintFilesByApex(artifact)
  const hintFiles = apexDomain ? (hintMap[apexDomain] ?? []) : []
  const fileList = buildCandidateFileList({
    artifact,
    apexDomain,
    priorityFilePaths,
    maxFiles,
  })

  const scannedFiles: string[] = []
  const occurrences: DomainCodeOccurrence[] = []
  const unreadable: string[] = []

  for (const rel of fileList) {
    if (occurrences.length >= MAX_OCCURRENCES_TOTAL) break
    const resolved = resolveReadableFile(artifact, rel)
    if (!resolved) {
      unreadable.push(rel)
      continue
    }
    scannedFiles.push(resolved.displayPath)
    const fileHits = findOccurrencesInFile({
      absolutePath: resolved.absolutePath,
      displayPath: resolved.displayPath,
      terms,
    })
    occurrences.push(...fileHits)
  }

  if (unreadable.length > 0) {
    notes.push(`Could not read: ${unreadable.slice(0, 6).join(", ")}${unreadable.length > 6 ? "…" : ""}`)
  }

  if (occurrences.length === 0) {
    notes.push(
      "No literal domain string in scanned files. It may be obfuscated, constructed at runtime, or in an unscanned path.",
    )
    if (priorityFilePaths.length > 0) {
      notes.push(`Finding pointed to: ${priorityFilePaths.join(", ")}`)
    }
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
