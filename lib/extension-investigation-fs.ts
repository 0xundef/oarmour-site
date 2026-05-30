import fs from "fs"
import path from "path"
import { spawnSync } from "child_process"
import {
  resolveIssueExtensionArtifact,
  type IssueExtensionArtifactContext,
} from "@/lib/issue-extension-artifact"

const DEFAULT_GREP_LIMIT = 100
const DEFAULT_FIND_LIMIT = 1000
const DEFAULT_LS_LIMIT = 500
const DEFAULT_MAX_BYTES = 50 * 1024
const GREP_MAX_LINE_LENGTH = 500

const SKIP_DIR_NAMES = new Set(["node_modules", "_metadata", ".git"])
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

export type ExtensionFsRoot = "extension" | "sidecar"

export type ExtensionInvestigationFsResult = {
  ok: boolean
  error?: string
  text: string
  notices?: string[]
}

function isPathInsideRoot(root: string, candidate: string): boolean {
  const resolvedRoot = path.resolve(root)
  const resolved = path.resolve(candidate)
  return resolved === resolvedRoot || resolved.startsWith(`${resolvedRoot}${path.sep}`)
}

function getRootDir(artifact: IssueExtensionArtifactContext, root: ExtensionFsRoot): string {
  return root === "sidecar" ? artifact.sidecarRoot : artifact.extensionRoot
}

function resolveRelativePath(
  artifact: IssueExtensionArtifactContext,
  relativePath: string | undefined,
  root: ExtensionFsRoot,
): { absolutePath: string; rootDir: string; relativeDisplay: string } | { error: string } {
  const rootDir = getRootDir(artifact, root)
  const raw = (relativePath ?? ".").replace(/\\/g, "/").trim() || "."
  if (raw.includes("\0") || raw.split("/").some((segment) => segment === "..")) {
    return { error: "Path must stay within the extension workspace (no .. segments)." }
  }

  const absolutePath = path.resolve(rootDir, raw)
  if (!isPathInsideRoot(rootDir, absolutePath)) {
    return { error: `Path escapes ${root} root: ${raw}` }
  }

  return {
    absolutePath,
    rootDir,
    relativeDisplay: raw === "." ? "." : path.posix.normalize(raw.replace(/\\/g, "/")),
  }
}

function truncateHead(content: string, maxBytes = DEFAULT_MAX_BYTES): { text: string; truncated: boolean } {
  if (Buffer.byteLength(content, "utf8") <= maxBytes) {
    return { text: content, truncated: false }
  }
  let bytes = 0
  const lines: string[] = []
  for (const line of content.split("\n")) {
    const lineBytes = Buffer.byteLength(`${line}\n`, "utf8")
    if (bytes + lineBytes > maxBytes) break
    lines.push(line)
    bytes += lineBytes
  }
  return { text: lines.join("\n"), truncated: true }
}

function truncateLine(line: string): { text: string; truncated: boolean } {
  if (line.length <= GREP_MAX_LINE_LENGTH) return { text: line, truncated: false }
  return { text: `${line.slice(0, GREP_MAX_LINE_LENGTH)}…`, truncated: true }
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}

function toPosixRelative(rootDir: string, absolutePath: string): string {
  return path.relative(rootDir, absolutePath).replace(/\\/g, "/")
}

function globToRegExp(pattern: string, fullPath: boolean): RegExp {
  let normalized = pattern.replace(/\\/g, "/")
  if (fullPath && normalized.includes("/") && !normalized.startsWith("**/") && normalized !== "**") {
    normalized = `**/${normalized}`
  }

  let regex = "^"
  for (let i = 0; i < normalized.length; i++) {
    const ch = normalized[i]
    if (ch === "*") {
      if (normalized[i + 1] === "*") {
        regex += ".*"
        i++
        if (normalized[i + 1] === "/") i++
      } else {
        regex += fullPath ? "[^/]*" : "[^/]*"
      }
      continue
    }
    if (ch === "?") {
      regex += "."
      continue
    }
    if (/[+^${}()|[\]\\.]/.test(ch)) {
      regex += `\\${ch}`
      continue
    }
    regex += ch
  }
  regex += "$"
  return new RegExp(regex, fullPath ? "" : "i")
}

function matchesGlob(relativePath: string, pattern: string): boolean {
  const normalized = relativePath.replace(/\\/g, "/")
  const fullPath = pattern.includes("/")
  const regex = globToRegExp(pattern, fullPath)
  const target = fullPath ? normalized : path.posix.basename(normalized)
  return regex.test(target)
}

function shouldSkipDir(name: string): boolean {
  return SKIP_DIR_NAMES.has(name)
}

function isScannableFile(filePath: string): boolean {
  return SCANNABLE_EXTENSIONS.has(path.extname(filePath).toLowerCase())
}

function walkFiles(params: {
  rootDir: string
  startDir: string
  fileFilter?: (absolutePath: string, relativePath: string) => boolean
}): string[] {
  const { rootDir, startDir, fileFilter } = params
  const results: string[] = []
  const queue = [startDir]

  while (queue.length > 0) {
    const dir = queue.shift()!
    let entries: fs.Dirent[]
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      continue
    }

    for (const entry of entries) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        if (shouldSkipDir(entry.name)) continue
        queue.push(full)
        continue
      }
      if (!entry.isFile()) continue
      const relativePath = toPosixRelative(rootDir, full)
      if (fileFilter && !fileFilter(full, relativePath)) continue
      results.push(full)
    }
  }

  return results
}

function tryRipgrep(params: {
  pattern: string
  searchPath: string
  rootDir: string
  glob?: string
  ignoreCase?: boolean
  literal?: boolean
  limit: number
}): { text: string; notices: string[] } | null {
  const probe = spawnSync("rg", ["--version"], { encoding: "utf8" })
  if (probe.error || probe.status !== 0) return null

  const args = ["--line-number", "--color=never", "--hidden", "--no-messages"]
  if (params.ignoreCase) args.push("--ignore-case")
  if (params.literal) args.push("--fixed-strings")
  if (params.glob) args.push("--glob", params.glob)
  args.push("--", params.pattern, params.searchPath)

  const result = spawnSync("rg", args, {
    encoding: "utf8",
    maxBuffer: DEFAULT_MAX_BYTES * 4,
  })
  if (result.error) return null
  if (result.status !== 0 && result.status !== 1 && !result.stdout?.trim()) {
    return null
  }

  const lines = (result.stdout ?? "")
    .split("\n")
    .map((line) => line.replace(/\r$/, ""))
    .filter(Boolean)

  if (lines.length === 0) {
    return { text: "No matches found", notices: [] }
  }

  const notices: string[] = []
  let outputLines = lines
  if (lines.length > params.limit) {
    outputLines = lines.slice(0, params.limit)
    notices.push(`${params.limit} matches limit reached. Use a higher limit or refine pattern.`)
  }

  const formatted = outputLines.map((line) => {
    const match = line.match(/^(.+?):(\d+):(.*)$/)
    if (!match) return line
    const [, filePart, lineNo, content] = match
    const relative =
      filePart.startsWith(params.rootDir) ?
        toPosixRelative(params.rootDir, filePart)
      : path.basename(filePart)
    const truncated = truncateLine(content)
    if (truncated.truncated) notices.push(`Some lines truncated to ${GREP_MAX_LINE_LENGTH} chars`)
    return `${relative}:${lineNo}:${truncated.text}`
  })

  const joined = formatted.join("\n")
  const { text, truncated } = truncateHead(joined)
  if (truncated) notices.push(`${formatSize(DEFAULT_MAX_BYTES)} limit reached`)
  return { text, notices: Array.from(new Set(notices)) }
}

export async function runExtensionGrep(
  artifact: IssueExtensionArtifactContext,
  params: {
    pattern: string
    path?: string
    root?: ExtensionFsRoot
    glob?: string
    ignoreCase?: boolean
    literal?: boolean
    context?: number
    limit?: number
  },
): Promise<ExtensionInvestigationFsResult> {
  const resolved = resolveRelativePath(artifact, params.path, params.root ?? "extension")
  if ("error" in resolved) {
    return { ok: false, error: resolved.error, text: "" }
  }

  if (!fs.existsSync(resolved.absolutePath)) {
    return { ok: false, error: `Path not found: ${resolved.relativeDisplay}`, text: "" }
  }

  const limit = Math.min(params.limit ?? DEFAULT_GREP_LIMIT, 500)
  const rg = tryRipgrep({
    pattern: params.pattern,
    searchPath: resolved.absolutePath,
    rootDir: resolved.rootDir,
    glob: params.glob,
    ignoreCase: params.ignoreCase,
    literal: params.literal,
    limit,
  })
  if (rg) {
    return { ok: true, text: rg.text, notices: rg.notices.length ? rg.notices : undefined }
  }

  const stat = fs.statSync(resolved.absolutePath)
  const searchFiles = stat.isDirectory()
    ? walkFiles({
        rootDir: resolved.rootDir,
        startDir: resolved.absolutePath,
        fileFilter: (_abs, rel) => {
          if (!isScannableFile(rel)) return false
          return params.glob ? matchesGlob(rel, params.glob) : true
        },
      })
    : isScannableFile(resolved.absolutePath) ? [resolved.absolutePath] : []

  if (searchFiles.length === 0) {
    return { ok: true, text: "No matches found" }
  }

  const flags = params.ignoreCase ? "i" : ""
  let regex: RegExp
  try {
    regex =
      params.literal ?
        new RegExp(params.pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), flags)
      : new RegExp(params.pattern, flags)
  } catch {
    return { ok: false, error: `Invalid regex pattern: ${params.pattern}`, text: "" }
  }

  const context = Math.max(0, params.context ?? 0)
  const notices: string[] = []
  const outputLines: string[] = []
  let matchCount = 0
  let linesTruncated = false

  for (const filePath of searchFiles) {
    if (matchCount >= limit) break
    let content: string
    try {
      content = fs.readFileSync(filePath, "utf8")
    } catch {
      continue
    }
    if (content.includes("\u0000")) continue

    const relativePath = toPosixRelative(resolved.rootDir, filePath)
    const lines = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n")

    for (let i = 0; i < lines.length; i++) {
      if (matchCount >= limit) break
      const line = lines[i] ?? ""
      if (!regex.test(line)) continue
      regex.lastIndex = 0
      matchCount++

      if (context === 0) {
        const truncated = truncateLine(line)
        if (truncated.truncated) linesTruncated = true
        outputLines.push(`${relativePath}:${i + 1}: ${truncated.text}`)
        continue
      }

      const start = Math.max(0, i - context)
      const end = Math.min(lines.length - 1, i + context)
      for (let current = start; current <= end; current++) {
        const row = lines[current] ?? ""
        const truncated = truncateLine(row)
        if (truncated.truncated) linesTruncated = true
        const prefix = current === i ? ":" : "-"
        outputLines.push(`${relativePath}${prefix}${current + 1}${prefix} ${truncated.text}`)
      }
    }
  }

  if (matchCount === 0) {
    return { ok: true, text: "No matches found" }
  }
  if (matchCount >= limit) {
    notices.push(`${limit} matches limit reached. Use a higher limit or refine pattern.`)
  }
  if (linesTruncated) {
    notices.push(`Some lines truncated to ${GREP_MAX_LINE_LENGTH} chars`)
  }

  const joined = outputLines.join("\n")
  const { text, truncated } = truncateHead(joined)
  if (truncated) notices.push(`${formatSize(DEFAULT_MAX_BYTES)} limit reached`)

  return { ok: true, text, notices: notices.length ? notices : undefined }
}

export async function runExtensionFind(
  artifact: IssueExtensionArtifactContext,
  params: {
    pattern: string
    path?: string
    root?: ExtensionFsRoot
    limit?: number
  },
): Promise<ExtensionInvestigationFsResult> {
  const resolved = resolveRelativePath(artifact, params.path, params.root ?? "extension")
  if ("error" in resolved) {
    return { ok: false, error: resolved.error, text: "" }
  }

  if (!fs.existsSync(resolved.absolutePath)) {
    return { ok: false, error: `Path not found: ${resolved.relativeDisplay}`, text: "" }
  }

  const limit = Math.min(params.limit ?? DEFAULT_FIND_LIMIT, 2000)
  const stat = fs.statSync(resolved.absolutePath)
  const searchRoot = stat.isDirectory() ? resolved.absolutePath : path.dirname(resolved.absolutePath)
  const files = walkFiles({
    rootDir: resolved.rootDir,
    startDir: searchRoot,
    fileFilter: (_abs, rel) => matchesGlob(rel, params.pattern),
  })

  if (files.length === 0) {
    return { ok: true, text: "No files found matching pattern" }
  }

  const notices: string[] = []
  let relativePaths = files.map((filePath) => toPosixRelative(resolved.rootDir, filePath)).sort()
  if (relativePaths.length > limit) {
    relativePaths = relativePaths.slice(0, limit)
    notices.push(`${limit} results limit reached. Use a higher limit or refine pattern.`)
  }

  const joined = relativePaths.join("\n")
  const { text, truncated } = truncateHead(joined)
  if (truncated) notices.push(`${formatSize(DEFAULT_MAX_BYTES)} limit reached`)

  return { ok: true, text, notices: notices.length ? notices : undefined }
}

export async function runExtensionLs(
  artifact: IssueExtensionArtifactContext,
  params: {
    path?: string
    root?: ExtensionFsRoot
    limit?: number
  },
): Promise<ExtensionInvestigationFsResult> {
  const resolved = resolveRelativePath(artifact, params.path, params.root ?? "extension")
  if ("error" in resolved) {
    return { ok: false, error: resolved.error, text: "" }
  }

  if (!fs.existsSync(resolved.absolutePath)) {
    return { ok: false, error: `Path not found: ${resolved.relativeDisplay}`, text: "" }
  }

  const stat = fs.statSync(resolved.absolutePath)
  if (!stat.isDirectory()) {
    return { ok: false, error: `Not a directory: ${resolved.relativeDisplay}`, text: "" }
  }

  const limit = Math.min(params.limit ?? DEFAULT_LS_LIMIT, 2000)
  let entries: string[]
  try {
    entries = fs.readdirSync(resolved.absolutePath)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { ok: false, error: `Cannot read directory: ${message}`, text: "" }
  }

  entries.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))

  const notices: string[] = []
  const rows: string[] = []
  for (const entry of entries) {
    if (rows.length >= limit) {
      notices.push(`${limit} entries limit reached. Use a higher limit for more.`)
      break
    }
    const fullPath = path.join(resolved.absolutePath, entry)
    let suffix = ""
    try {
      if (fs.statSync(fullPath).isDirectory()) suffix = "/"
    } catch {
      continue
    }
    rows.push(`${entry}${suffix}`)
  }

  if (rows.length === 0) {
    return { ok: true, text: "(empty directory)" }
  }

  const joined = rows.join("\n")
  const { text, truncated } = truncateHead(joined)
  if (truncated) notices.push(`${formatSize(DEFAULT_MAX_BYTES)} limit reached`)

  return { ok: true, text, notices: notices.length ? notices : undefined }
}

export async function runExtensionInvestigationTool(
  storeId: string,
  tool: "grep" | "find" | "ls",
  params: Record<string, unknown>,
): Promise<ExtensionInvestigationFsResult> {
  const artifact = await resolveIssueExtensionArtifact(storeId)
  if (!artifact) {
    return {
      ok: false,
      error: "Extension version or sidecar not found for this store.",
      text: "",
    }
  }

  const root = params.root === "sidecar" ? "sidecar" : "extension"

  switch (tool) {
    case "grep":
      return runExtensionGrep(artifact, {
        pattern: String(params.pattern ?? ""),
        path: typeof params.path === "string" ? params.path : undefined,
        root,
        glob: typeof params.glob === "string" ? params.glob : undefined,
        ignoreCase: params.ignoreCase === true,
        literal: params.literal === true,
        context: typeof params.context === "number" ? params.context : undefined,
        limit: typeof params.limit === "number" ? params.limit : undefined,
      })
    case "find":
      return runExtensionFind(artifact, {
        pattern: String(params.pattern ?? ""),
        path: typeof params.path === "string" ? params.path : undefined,
        root,
        limit: typeof params.limit === "number" ? params.limit : undefined,
      })
    case "ls":
      return runExtensionLs(artifact, {
        path: typeof params.path === "string" ? params.path : undefined,
        root,
        limit: typeof params.limit === "number" ? params.limit : undefined,
      })
  }
}
