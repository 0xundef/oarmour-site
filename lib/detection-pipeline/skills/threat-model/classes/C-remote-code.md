# Class C — Remote code / dynamic execution

**Category:** `remote-code`
**Canonical example:** Cyberhaven-cluster stager (Dec 2024) — a benign-at-
review extension that fetches its real payload from a C2 after install; also
MV2 remote-hosted code and `eval` of fetched content.
**Provenance:** public, widely-reported incident (Cyberhaven extension
compromise, Dec 2024). Added in this session for illustration; verify against
the primary writeup before external citation. Not part of this skill's
original first-party basis.
**Protects:** the integrity of what the extension actually executes after the
store approves it.

## Rule

An extension's behavior must be fully determined by its packaged, reviewed
code. Code (or behavior-defining config) fetched from a remote endpoint after
install defeats store review and lets the author change behavior silently —
treat it as untrusted-by-design.

## Canonical example

The Cyberhaven-cluster compromise (Dec 2024): a store-approved extension fetches
its real payload from a C2 after install, bypassing review. Same class: MV2
remote-hosted scripts and `eval` of fetched content.

## Detect

1. **Dynamic code execution:**
   ```bash
   rg -n "eval\(|new Function\(|Function\(|import\(['\"]https?|importScripts\(|setTimeout\(['\"]" --glob '*.{js,ts}'
   ```
2. **Fetch-then-execute.** Trace any `fetch`/`XHR`/`WebSocket` response into a
   code-exec sink (`eval`, `Function`, `innerHTML`, `import`) or into a config
   object that **gates behavior** (feature flags, target lists, on/off switch).
3. **Remote config that changes behavior** — fetched JSON selecting which
   sites/actions to run is behavior-defining remote config (finding even
   without `eval`).
4. **CSP red flags** in `manifest.json`: `unsafe-eval`, `unsafe-inline`,
   remote `script-src` widen this surface.
5. **Obfuscation hiding the destination.** `atob`/`fromCharCode`/string-array
   decoders assembling a URL or payload at runtime — de-obfuscate and resolve
   the literal (see SKILL.md preprocessing tiers).

## Heuristic

*a remote response flows into a code-exec sink OR into a config that gates
behavior, OR dynamic `eval`/`Function`/remote `import()` exists, OR CSP allows
`unsafe-eval`/remote `script-src` → "remote code / remote-config behavior
switch."*

## Notes

This is the mechanism behind "clean at review, malicious in the field." A
benign sample that *depends on* a remote fetch for its real behavior is the
finding — you don't need to capture the live payload to flag the architecture.
