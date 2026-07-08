---
name: chrome-ext-audit
description: Security audit methodology and per-class detection rules for Chrome/Chromium extensions whose JS is compiled (webpack/rollup, minified, usually no sourcemap). Generic extension surface; layer wallet-ext-audit on top for web3 wallets.
---

# Chrome Extension Security Audit

Knowledge for auditing Chrome/Chromium extensions whose JavaScript is
**compiled** (webpack/rollup output: minified, bundled, usually no sourcemap).
Covers the **generic** extension attack surface that applies to any extension.
For crypto-wallet / web3 extensions, layer `wallet-ext-audit` ON TOP — this
skill stays vendor- and domain-agnostic.

Each vuln class is a **generalized detection rule**. Any named incident in a
class file is only a *canonical example* that proves the class is real — apply
the rule to the target in front of you, not to a vendor.

### Provenance of the examples (read this)

Unlike `wallet-ext-audit` — whose classes were distilled from a provided
first-party corpus (the MetaMask CVE writeup + the Trust Wallet v2.68 incident
report) — this skill's **original basis was the compiled-JS audit scenario the
operator specified plus general, well-established extension-security
knowledge**, not a cited incident corpus. The per-class `Canonical example:`
lines were added afterward for illustration and each carries a `Provenance:`
tag:

- **public incident** — a real, publicly-reported case (e.g. DataSpii,
  Cyberhaven). Treat as illustrative; verify against the primary writeup before
  citing externally.
- **illustrative pattern** — a representative pattern from general knowledge,
  not tied to one verified incident.

The *detection rules* (Detect / Heuristic) stand on their own regardless of the
example's provenance.

## How to use this skill

This `SKILL.md` is the **router + shared methodology**. The methodology
sections below (manifest, what survives compilation, preprocessing tiers,
citing, confidence) are foundational and are also referenced by
`wallet-ext-audit`. Each vuln class lives in its own file under `classes/` —
read the one(s) matching the surface you're auditing. Don't load all of them
up front; triage from the manifest + grep anchors, then open the relevant
class file for the full detection procedure.

| Class | File | One-line trigger |
|-------|------|------------------|
| A — Excessive / over-broad permissions | `classes/A-excessive-permissions.md` | requested capability far beyond stated purpose |
| B — Data exfiltration | `classes/B-data-exfiltration.md` | sensitive source (cookies/history/DOM) → off-device sink |
| C — Remote code / dynamic execution | `classes/C-remote-code.md` | fetched payload, `eval`, dynamic `import()`, remote `script-src` |
| D — Insecure messaging | `classes/D-insecure-messaging.md` | unvalidated `onMessageExternal`/`postMessage` origin/sender |
| E — Content-script DOM injection | `classes/E-dom-injection.md` | untrusted data into `innerHTML`/`document.write` |
| F — Privacy / tracking | `classes/F-privacy-tracking.md` | reading history/bookmarks/geolocation, sending off-device |
| G — Supply chain | `classes/G-supply-chain.md` | obfuscated/bundled payload, post-install behavior change |

## 1. The manifest is your map (always plaintext)

`manifest.json` is never compiled. Read it first; it bounds the worst case.

- `manifest_version`: 2 (legacy, background pages, looser CSP) vs 3
  (service worker, stricter CSP, `host_permissions` split out).
- **High-risk permissions**: `<all_urls>`, broad `host_permissions`,
  `cookies`, `webRequest` / `webRequestBlocking`, `debugger`, `proxy`,
  `nativeMessaging`, `declarativeNetRequest`, `scripting`, `tabs`,
  `history`, `bookmarks`, `clipboardRead`, `management`.
- `content_security_policy`: any `unsafe-eval` / `unsafe-inline` / remote
  `script-src` is a red flag (remote code execution surface).
- `externally_connectable`: which sites/extensions can message this one.
- `web_accessible_resources`: files exposed to web pages (fingerprinting,
  injection surface).
- `content_scripts`: which URLs get script injection and at what run time.

## 2. What survives compilation (your real anchors)

Minification destroys variable names but these survive and are the reliable
way to locate behavior — grep for them, then read backward to the source:

| Survives | Why it matters |
|----------|----------------|
| String literals (URLs, domains, keys) | exfil targets, remote config, secrets |
| `chrome.*` / `browser.*` API names | global object, never renamed → permission use |
| `fetch`, `XMLHttpRequest`, `sendBeacon`, `WebSocket` | network sinks |
| `eval`, `Function(`, `atob`, `import(` | remote/dynamic code execution |
| `postMessage`, `onMessageExternal`, `onConnectExternal` | message-passing attack surface |
| DOM sinks: `innerHTML`, `document.write`, `insertAdjacentHTML` | injection |

## 3. Preprocessing tiers (compiled → readable)

1. **sourcemap** (if any `.map`): reconstruct with the `source-map` package.
   Highest fidelity.
2. **webpack unpack**: `npx webcrack` splits the bundle into per-module
   files — the default best move for webpack minify. Cite by module.
3. **deobfuscation** (obfuscator.io signatures): `npx synchrony deobfuscate`
   then webcrack. Detect via many `_0x[a-f0-9]+` ids + a big string array +
   a self-invoking decoder IIFE.
4. **beautify fallback**: `npx prettier` / `js-beautify` to pretty-print.

Always record the **fidelity** achieved; downstream confidence depends on it.

## 4. Method

1. Map trust boundaries: web page ↔ content script ↔ background/service
   worker ↔ external pages ↔ persistent storage.
2. Sources = untrusted (web/DOM/message/network) + sensitive (cookies/
   history/clipboard) data. Sinks = DOM render, navigation, code-exec,
   storage, network.
3. Taint: flag any source→sink flow lacking validation / sanitization /
   allowlist.
4. Audit `manifest.json` as code, not just JS.
5. Open the matching `classes/*.md` for the full per-class detection
   procedure and heuristic before asserting a finding.

Map each finding to a category: `permissions`, `dataflow`, `remote-code`,
`messaging`, `privacy`, `supply-chain`.

## 5. Citing findings in compiled code

Never cite raw minified line/column numbers. Cite:
`file` + nearest stable **anchor** (string literal / `chrome.*` call /
webpack module id) + ~3 surrounding lines from the **normalized** copy.

## 6. Confidence discipline

- `sourcemap` / `unpacked` / `recovered` → findings can be high confidence.
- `beautified` / `raw` → flag high-impact findings as
  "needs manual confirmation" instead of asserting them outright.
- Never invent a finding to fill a section. "Clean" is a valid result.
