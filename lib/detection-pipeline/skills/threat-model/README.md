# Threat model corpus (vendored)

Vendored snapshot of the `chrome-ext-audit` skill from
[`0xundef/defending-agent`](https://github.com/0xundef/defending-agent)
(`.pi/skills/chrome-ext-audit/`).

- `SKILL.md` — router + shared methodology (manifest, what survives
  compilation, preprocessing tiers, citing, confidence discipline).
- `classes/*.md` — per-vulnerability-class detection rules (A–G).

This corpus is the **default threat model** for the detection pipeline.
`loadThreatModel()` reads every `.md` here (recursively, frontmatter stripped)
and injects the concatenation into the find/dedupe/report system prompts.

**Drift:** this is a snapshot. To track upstream, re-download from the source
repo, or point `DETECTION_THREAT_MODEL_DIR` at a checked-out copy.

**Scope:** the methodology references preprocessing tiers (sourcemap / webcrack /
synchrony / prettier). v1 of the pipeline does **not** run preprocessing — find
agents audit the unpacked source directly with `sourceFidelity: raw|beautified`,
and high-severity findings carry `needsManualConfirmation: true` per the skill's
confidence discipline. Preprocessing is a planned phase-2 addition.
