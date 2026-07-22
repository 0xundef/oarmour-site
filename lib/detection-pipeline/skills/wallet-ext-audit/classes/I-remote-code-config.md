# Class I — Remote code / remote config / C2-gated behavior

**Category:** `remote-code`
**Canonical example:** Cyberhaven-cluster `worker.js` C2 config fetch (2024–25);
"stager fetches the real payload days after store approval"; C2-gated
phishing/decoy switching in fake-wallet samples.
**Provenance:** public incident (Cyberhaven-cluster, 2024–25); added from the
incident corpus — verify against the primary writeup.
**Protects:** the integrity of what the extension actually executes after install.

## Rule

An extension's behavior must be fully determined by its packaged, reviewed code.
Code or behavior-defining configuration fetched from a remote endpoint after
install defeats store review and lets the author change behavior silently —
treat it as untrusted-by-design.

## Canonical example

- **Delayed/staged payload.** The shipped extension is benign at review time; a
  stager fetches the real malicious payload from an attacker domain days/weeks
  later, bypassing automated review.
- **C2-gated activation.** Malicious logic triggers only when a C2 returns a
  "dirty" config, with anti-sandbox checks and reflective in-memory execution to
  evade analysis; when the C2 is offline/clean the extension behaves normally.

## Detect

1. **Dynamic code execution:**
   ```bash
   rg -n "eval\(|new Function\(|Function\(|import\(['\"]https?|importScripts\(|setTimeout\(['\"]" --glob '*.{js,ts}'
   ```
   Flag `eval` / `Function(` / dynamic `import()` of a remote URL /
   `importScripts` of remote, especially fed by fetched content.
2. **Fetch-then-execute.** Trace any `fetch`/`XHR`/`WebSocket` response into a
   code-exec sink (`eval`, `Function`, `innerHTML`, `import`) or into a config
   object that **gates behavior** (feature flags, target lists, on/off switch).
3. **Remote config that changes behavior.** A fetched JSON whose fields select
   which addresses to target, which UI to show, or whether to activate =
   behavior-defining remote config (finding even without `eval`).
4. **C2 reachability branching / anti-analysis.** Code that behaves differently
   based on a remote probe, timing, sandbox/devtools detection, or
   `navigator.webdriver` checks.
5. **Obfuscation that hides the destination.** `atob`/`fromCharCode`/string-
   array decoders assembling a URL or payload at runtime — de-obfuscate and
   resolve the literal (see `chrome-ext-audit` SKILL.md §3 preprocessing tiers).
6. **CSP red flags.** `unsafe-eval` / `unsafe-inline` / remote `script-src` in
   `manifest.json` widen this surface.

## Heuristic

*a remote response (fetch/XHR/WebSocket) flows into a code-exec sink OR into a
config that gates behavior, OR dynamic `eval`/`Function`/remote `import()`
exists, OR behavior branches on C2 reachability / sandbox detection →
"remote code / remote-config behavior switch."*

## Notes

This is the mechanism that makes Class D (telemetry exfil), Class H
(impersonation), and supply-chain pushes "clean at review, malicious in the
field." A benign-looking sample that *depends on* a remote fetch for its real
behavior is the finding — you don't need to capture the live payload to flag the
architecture. Note fidelity per `chrome-ext-audit` SKILL.md §6 if only beautified.
