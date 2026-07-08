import "server-only"

import fs from "fs"
import path from "path"
import matter from "gray-matter"

const skillsDirectory = path.join(process.cwd(), "lib", "detection-pipeline", "skills")

const cache = new Map<string, string>()

/**
 * Load a stage SOP's instruction body (frontmatter stripped) from
 * `lib/detection-pipeline/skills/<name>.md`. Injected into the agent system
 * prompt; the markdown is the source of truth for the SOP (edit the `.md`,
 * not this code). Cached per process; restart to pick up edits.
 */
export function loadPipelineSkill(name: string): string {
  const cached = cache.get(name)
  if (cached !== undefined) return cached

  const fullPath = path.join(skillsDirectory, `${name}.md`)
  const raw = fs.readFileSync(fullPath, "utf8")
  const body = matter(raw).content.trim()

  cache.set(name, body)
  return body
}
