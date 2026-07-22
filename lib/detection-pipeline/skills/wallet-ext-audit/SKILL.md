---
name: wallet-ext-audit
description: Vendor-agnostic vuln classes for crypto-wallet browser extensions (secret handling, web-accessible clickjacking, signing trust, signature phishing, clipboard/address swap, telemetry/supply-chain seed exfil, impersonation, remote code, dApp messaging, session theft, dependency supply-chain). Use when the target is any wallet/web3 extension.
---

# Crypto-Wallet Extension Audit

Domain knowledge for auditing **any crypto-wallet / web3 browser extension**
(keyring/signing extension — MetaMask, Trust Wallet, Phantom, Rabby, Coinbase
Wallet, …). Layer this ON TOP of `chrome-ext-audit` — that skill covers the
generic extension surface; this one covers the wallet-specific bug classes.

Each class is a **generalized detection rule**. The named incident in a class
file (a public CVE, advisory, or breach) is only the *canonical example* that
proves the class is real — apply the rule to the target in front of you, not to
a vendor. Detection keys on generic wallet behaviors and tokens, never on a
specific brand's strings.

A wallet extension's crown jewels: **the seed/private key** and **what the
user is induced to sign**. Every class protects one of those.

## How to use this skill

This `SKILL.md` is the **router**. Each vuln class lives in its own file under
`classes/` — read the one(s) matching the surface you're auditing. Don't load
all twelve up front; triage from the manifest + grep anchors below, then open
the relevant class file for the full detection procedure.

| Class | File | One-line trigger |
|-------|------|------------------|
| A — Secret in a recoverable place | `classes/A-secret-exposure.md` | secret in non-`password` field / persisted unencrypted |
| B — Web-accessible page clickjacking | `classes/B-webaccessible-clickjacking.md` | interactive HTML in `web_accessible_resources`, no anti-framing |
| C — Chain identity from untrusted input | `classes/C-chain-identity-trust.md` | `chainId` used for signing comes from an RPC response |
| D — Seed exfil via disguised telemetry | `classes/D-telemetry-seed-exfil.md` | decrypted seed reaches a `capture`/`track`/`log` sink |
| E — Clipboard hijack / address swap | `classes/E-clipboard-address-swap.md` | `clipboard*` perm + address regex + paste/copy mutation |
| F — Transaction / recipient tampering | `classes/F-transaction-tampering.md` | injected script rewrites `to`/`value`/bundles hidden approval |
| G — Blind signing / signature phishing | `classes/G-signature-phishing.md` | `eth_sign`/Permit/`signTypedData` rendered as hex, no simulation |
| H — Impersonation + remote payload | `classes/H-impersonation-remote-payload.md` | Unicode/brand spoof, remote iframe phishing, two-layer |
| I — Remote code / remote config | `classes/I-remote-code-config.md` | fetched payload, `eval`, dynamic `import()`, C2-gated behavior |
| J — Insecure dApp messaging / provider | `classes/J-insecure-dapp-messaging.md` | unvalidated `onMessageExternal`/`postMessage`, EIP-6963 spoof |
| K — Session / cookie auth-state theft | `classes/K-session-cookie-theft.md` | `cookies`/`document.cookie` → off-device sink |
| L — Dependency supply-chain | `classes/L-dependency-supply-chain.md` | bundled dep hooks `window.ethereum`/`fetch`/`XHR` |

Classes A–D are the original four (secret exposure, clickjacking, signing
trust, telemetry exfil). E–L were derived from the 2024–2026 incident
corpus (Cyberhaven OAuth hijack, Trust Wallet v2.68 API-key push, fake
TronLink/Braavos remote-iframe samples, the chalk/debug npm `window.ethereum`
drainer, Permit/EIP-712 normalization phishing).

## Wallet-specific tokens (grep anchors, survive minification)

| Token family | Why |
|--------------|-----|
| `mnemonic`, `seedPhrase`, `seed`, `secretRecoveryPhrase`, `srp`, `entropy` | seed sources |
| `privateKey`, `privKey`, `keyring`, `vault`, `encryptor`, `exportAccount` | key material |
| `signTransaction`, `eth_signTransaction`, `personal_sign`, `eth_sign`, `signTypedData`, `eth_signTypedData_v4`, `eth_sendTransaction` | signing sinks |
| `chainId`, `net_version`, `networkId`, `getChainId`, `Common`, `@ethereumjs` | chain identity |
| `approve(`, `setApprovalForAll`, `permit`, `Permit2`, `eth_requestAccounts` | dApp-facing risk surface |
| `posthog`, `capture(`, `Sentry`, `analytics`, `Segment`, `amplitude`, `mixpanel`, `gtag` | telemetry sinks (seed-exfil disguise) |
| `unlock`, `decrypt`, `submitPassword`, `verifyPassword`, biometric/`webauthn` | post-auth decrypt path |
| `clipboardRead`, `clipboardWrite`, `navigator.clipboard`, `execCommand('copy')`, `0x[a-fA-F0-9]{40}` | clipboard / address-swap surface |
| `window.ethereum`, `eip6963`, `announceProvider`, `requestProvider`, `injectScript` | provider injection / discovery |
| `\u202E`, `\u200B`, `fromCharCode`, `atob`, remote-config URLs | impersonation / remote-payload obfuscation |

String literals survive compilation even when names don't — grep these, then
read backward to the source.

## Cross-cutting wallet checklist

| Area | Grep / inspect | Red flag | Class |
|------|----------------|----------|-------|
| Secret rendering | `<input type>`, JSX bound to `mnemonic`/`privateKey` | non-`password` field holding a secret | A |
| Secret storage | `localStorage`, `chrome.storage`, IndexedDB writes | unencrypted secret persisted / not cleared | A |
| Manifest exposure | `web_accessible_resources` | interactive HTML, no `matches` allowlist | B |
| Framing | CSP `frame-ancestors`, `X-Frame-Options`, framebusting | missing on exposed pages | B |
| Redirect sinks | `location.href`, `window.open`, `runtime.getURL` | target from untrusted input, no scheme allowlist | B |
| Signing trust | `net_version`, RPC responses, `signTransaction` | remote value in a signing decision | C |
| Telemetry exfil | `posthog`/`capture`, `Sentry`, analytics on unlock path | decrypted seed reaching a telemetry/log sink | D |
| Destination domains | every network + analytics host literal | lookalike/typosquat or new domain vs vendor's real one | D, H, I, K |
| Clipboard | `clipboard*` perm, address regex, `copy`/`paste` listeners | address substitution on copy/paste | E |
| Tx integrity | `eth_sendTransaction` params, `to`/`value`/`data` rewrite | recipient/amount mutated, bundled hidden approval | F |
| Signing UX | `eth_sign`, `signTypedData`, `permit`, `verifyingContract` | blind hex sign, no simulation, numeric-address normalization | G |
| Brand spoof | extension name/desc, `\u202E`/`\u200B`, remote iframe src | RTL/zero-width spoof, popup loads remote phishing page | H |
| Remote code | `eval`, `Function(`, `import(`, fetched config gating behavior | post-install behavior change, C2-gated activation | I |
| dApp messaging | `onMessageExternal`, `externally_connectable`, `postMessage` | unvalidated sender/origin; EIP-6963 provider spoof | J |
| Session theft | `chrome.cookies`, `document.cookie` | auth cookie/token → off-device sink | K |
| Dependencies | bundled deps hooking `window.ethereum`/`fetch`/`XHR` | dep mutates wallet/network APIs; new dep vs prior version | L |

## Method

1. Map trust boundaries: web page ↔ content script ↔ background/service
   worker ↔ RPC endpoint ↔ encrypted vault.
2. Sources = secrets + remote (RPC/dApp) data. Sinks = DOM render, storage,
   navigation, clipboard, **signing**, network/telemetry.
3. Taint: flag any source→sink flow lacking validation / masking / allowlist.
4. Audit `manifest.json` as code, not just JS.
5. Confirm **positive controls exist** — masking, secret clearing, framing
   headers, explicit user chainId, signature simulation, address checks.
   Their *absence* is itself the finding.
6. Open the matching `classes/*.md` for the full per-class detection
   procedure and heuristic before asserting a finding.

Map each finding to a category: `secret-exposure`, `clickjacking`,
`signing-trust`, `signature-phishing`, `clipboard-swap`, `tx-tampering`,
`impersonation`, `remote-code`, `messaging`, `session-theft`,
`supply-chain` (telemetry-disguised seed exfil / dependency backdoor; plus the
generic categories from `chrome-ext-audit`).
