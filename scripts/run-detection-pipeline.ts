/**
 * Detection pipeline dev entry (v1 manual trigger).
 *
 * Usage:
 *   NODE_OPTIONS='--conditions react-server' npx tsx scripts/run-detection-pipeline.ts \
 *     <storeId> <version> [--runId <id>] [--source static|runtime|general] [--domains a,b]
 *
 * The `react-server` condition makes `import "server-only"` a no-op so the @/lib tree
 * (prisma, finding-resolution-store, …) imports cleanly outside Next.js.
 *
 * Requires: ANTHROPIC_API_KEY in env, DATABASE_URL (for suppression pre-filter),
 * and an unpacked extension source tree at
 * <EXTENSION_STORAGE_ROOT>/chrome-extension-analyzer/<storeId>/<version>/.
 */
import { runDetectionPipeline } from "@/lib/detection-pipeline/orchestrator"
import { resolvePipelineArtifact } from "@/lib/detection-pipeline/storage"
import fs from "fs"

function parseArgs(argv: string[]) {
  const positional: string[] = []
  let runId: string | undefined
  let source: "static" | "runtime" | "general" | undefined
  let domains: string[] | undefined
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === "--runId") runId = argv[++i]
    else if (a === "--source") source = argv[++i] as "static" | "runtime" | "general"
    else if (a === "--domains") domains = argv[++i]?.split(",").map((s) => s.trim()).filter(Boolean)
    else if (a === "--help" || a === "-h") {
      console.log("Usage: run-detection-pipeline.ts <storeId> <version> [--runId <id>] [--source static|runtime|general] [--domains a,b]")
      process.exit(0)
    } else positional.push(a)
  }
  return { positional, runId, source, domains }
}

async function main() {
  const { positional, runId, source, domains } = parseArgs(process.argv.slice(2))
  const storeId = positional[0]
  const version = positional[1]
  if (!storeId || !version) {
    console.error("Usage: run-detection-pipeline.ts <storeId> <version> [--runId <id>] [--source ...] [--domains a,b]")
    process.exit(2)
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("ANTHROPIC_API_KEY is required (get one at https://platform.claude.com/)")
    process.exit(2)
  }

  const artifact = resolvePipelineArtifact(storeId, version, runId)
  if (!fs.existsSync(artifact.unpackRoot)) {
    console.error(`Unpacked extension source not found: ${artifact.unpackRoot}`)
    console.error("Run the extension analyzer first so the source tree exists.")
    process.exit(1)
  }

  console.log(`[detection-pipeline] store=${storeId} version=${version} source=${source ?? "general"} runId=${runId ?? "-"}`)
  if (domains) console.log(`[detection-pipeline] candidate domains: ${domains.join(", ")}`)

  const result = await runDetectionPipeline({
    storeId,
    version,
    runId,
    candidateDomains: domains,
    source,
  })

  console.log("\n=== detection pipeline complete ===")
  console.log(`runDir:   ${result.runDir}`)
  console.log(`runId:    ${result.runId}`)
  console.log(`stages:`)
  for (const [name, s] of Object.entries(result.manifest.stages)) {
    console.log(`  ${name}: ${s.status}${s.file ? ` → ${s.file}` : ""}${s.error ? ` (err: ${s.error})` : ""}`)
  }
  console.log(`sourceFidelity: ${result.manifest.sourceFidelity}`)
  console.log(`report:   ${result.runDir}/report.md`)
}

main().catch((err) => {
  console.error("detection-pipeline failed:", err)
  process.exit(1)
})
