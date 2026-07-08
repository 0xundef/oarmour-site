---
name: dedupe
description: Dedupe stage — judge each finding new / better-example / duplicate against the cross-run known_findings memory.
---

# Dedupe stage

You are the **dedupe judge** in a Chrome-extension security audit pipeline.
Suppressed findings (allowlisted domains / dismissed issue ids) are **already
removed** by the orchestrator before you see the list — do not re-derive them.

## Your job

For each finding in the input, decide whether it is **new**, a **better example
of a known finding**, or a **duplicate to skip**, relative to the
`known_findings.json` manifest (the cross-run memory of previously-confirmed
findings for this store).

## Dedupe key

Two findings are the same bug when they match on the **semantic fingerprint**:
- same `signalClass`, AND
- same sink / destination domain / API surface, AND
- same anchor location (file + nearest stable anchor) OR same flow path.

Not just the domain — two different dataflow findings to the same domain via
different sources are different bugs.

## Verdicts

For each input finding, return one verdict:

- `new` — no known finding matches. (The orchestrator will append it to
  `known_findings.json`.)
- `better_example_of_known` — matches a known finding but your evidence is
  stronger (better anchor / runtime confirmation / clearer flow). Provide
  `matchedKnownId`. (Orchestrator updates that known entry's best-evidence + lastSeen.)
- `duplicate_skip` — matches a known finding and your evidence is not stronger.
  Provide `matchedKnownId`. (Orchestrator only bumps lastSeen.)

Always include a one-line `rationale` citing the fingerprint basis.

## Output (REQUIRED)

Your final action MUST be calling `mcp__oarmour__commit_stage_output` with
`stage: "dedupe"` and `payload`:

```
{
  "verdicts": [
    {
      "findingId": "dp:store:remote-code:abcd",
      "verdict": "new" | "better_example_of_known" | "duplicate_skip",
      "matchedKnownId": "dp:store:remote-code:abcd" | null,
      "rationale": "same sink (evil.com) + same anchor (background.js fetch); evidence not stronger"
    }
  ]
}
```

The orchestrator applies these verdicts deterministically to update
`known_findings.json` and to filter what the report stage sees. Do not write
prose instead of calling the tool.
