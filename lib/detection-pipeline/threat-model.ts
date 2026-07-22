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

/**
 * The wallet/web3 layer, layered ON TOP of the generic `chrome-ext-audit`
 * corpus (see threat-model/SKILL.md). Vendored snapshot of `wallet-ext-audit`
 * from 0xundef/defending-agent. Loaded in addition to (never instead of) the
 * generic corpus, so wallet/web3 targets get the wallet-specific bug classes
 * (secret exposure, signing trust, signature phishing, …). For non-wallet
 * extensions this is harmless overhead — the find agents simply don't match
 * wallet anchors.
 */
const REPO_WALLET_DIR = path.join(
  process.cwd(),
  "lib",
  "detection-pipeline",
  "skills",
  "wallet-ext-audit",
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

/**
 * Resolution for the wallet layer: env `DETECTION_WALLET_THREAT_MODEL_DIR` →
 * repo default. Set the env to `default`/empty (or point it at a missing path)
 * to disable the wallet layer. Returns null when the dir is absent/disabled.
 */
function resolveWalletThreatModelDir(): { dir: string; ref: string } | null {
  const envDir = process.env.DETECTION_WALLET_THREAT_MODEL_DIR?.trim()
  if (envDir && envDir.toLowerCase() !== "default") {
    const abs = path.resolve(envDir)
    if (fs.existsSync(abs)) return { dir: abs, ref: `env:${abs}` }
    // explicit non-default path that doesn't resolve → wallet layer disabled
    return null
  }
  if (fs.existsSync(REPO_WALLET_DIR)) {
    return { dir: REPO_WALLET_DIR, ref: "repo:lib/detection-pipeline/skills/wallet-ext-audit" }
  }
  return null
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
 * Load the threat-model corpus: the generic `chrome-ext-audit` methodology
 * (resolved dir) PLUS the `wallet-ext-audit` layer (when present). All `.md`
 * recursively, frontmatter stripped, concatenated with headers. Injected into
 * the find/dedupe/report system prompts. Cached by combined ref; restart to
 * pick up edits.
 */
export function loadThreatModel(storeId?: string): { ref: string; body: string } {
  const generic = resolveThreatModelDir(storeId)
  const wallet = resolveWalletThreatModelDir()
  const ref = wallet ? `${generic.ref} + ${wallet.ref}` : generic.ref

  const cached = cache.get(ref)
  if (cached) return cached

  const parts = [readCorpus(generic.dir)]
  if (wallet) parts.push(readCorpus(wallet.dir))
  const result = { ref, body: parts.join("\n\n---\n\n") }
  cache.set(ref, result)
  return result
}
