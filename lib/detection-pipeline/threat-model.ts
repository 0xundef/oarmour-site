import "server-only"

import fs from "fs"
import path from "path"
import matter from "gray-matter"
import { getAgentQueueRoot } from "@/lib/extension-storage"

const REPO_DEFAULT_DIR = path.join(
  process.cwd(),
  "lib",
  "detection-pipeline",
  "skills",
  "threat-model",
)

const cache = new Map<string, { ref: string; body: string }>()

/** Resolution order: env `DETECTION_THREAT_MODEL_DIR` → per-store dir → repo default. */
function resolveThreatModelDir(storeId?: string): { dir: string; ref: string } {
  const envDir = process.env.DETECTION_THREAT_MODEL_DIR?.trim()
  if (envDir && envDir.toLowerCase() !== "default") {
    const abs = path.resolve(envDir)
    if (fs.existsSync(abs)) return { dir: abs, ref: `env:${abs}` }
  }
  if (storeId) {
    const perStore = path.join(
      getAgentQueueRoot(),
      "extension-data",
      storeId,
      "threat-model",
    )
    if (fs.existsSync(perStore)) return { dir: perStore, ref: `store:${storeId}` }
  }
  return { dir: REPO_DEFAULT_DIR, ref: "repo:lib/detection-pipeline/skills/threat-model" }
}

function readCorpus(dir: string): string {
  const chunks: string[] = []

  const walk = (current: string, relDepth: string) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const child = path.join(current, entry.name)
      const rel = relDepth ? `${relDepth}/${entry.name}` : entry.name
      if (entry.isDirectory()) {
        walk(child, rel)
        continue
      }
      if (!entry.name.endsWith(".md")) continue
      // README is documentation, not part of the injected corpus.
      if (entry.name.toLowerCase() === "readme.md") continue
      const raw = fs.readFileSync(child, "utf8")
      const body = matter(raw).content.trim()
      chunks.push(`## << ${rel} >>\n\n${body}`)
    }
  }

  walk(dir, "")
  return chunks.join("\n\n---\n\n")
}

/**
 * Load the threat-model corpus (all `.md` under the resolved directory, recursively,
 * frontmatter stripped, concatenated with headers). Injected into the find/dedupe/
 * report system prompts. Cached per resolved directory; restart to pick up edits.
 */
export function loadThreatModel(storeId?: string): { ref: string; body: string } {
  const { dir, ref } = resolveThreatModelDir(storeId)
  const cached = cache.get(dir)
  if (cached && cached.ref === ref) return cached

  const body = readCorpus(dir)
  const result = { ref, body }
  cache.set(dir, result)
  return result
}
