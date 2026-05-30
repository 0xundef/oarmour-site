---
title: "Hardening the signing surface: security improvements after the February 2025 incident"
description: "A focused account of Safe{Wallet} security changes shipped after the 21 February 2025 frontend compromise—hash validation, signing hardening, bundle integrity, and pre-sign review—not a full product security changelog."
date: "2025-02-28"
author: "OArmour Team"
category: "code"
---

In February 2025, the crypto industry faced one of the largest thefts on record when approximately **$1.4–1.5 billion** was drained from Bybit's cold-wallet operations. Independent forensic investigations—including reports from [Sygnia](https://www.dlnews.com/articles/defi/safe-wallet-compromise-behind-bybit-hack/) and [Verichains](https://thedefiant.io/news/hacks/safe-wallet-found-responsible-for-bybit-s-usd1-5-billion-hack)— traced the root cause to **malicious JavaScript served from Safe{Wallet}'s frontend infrastructure**, not to a flaw in Safe smart contracts themselves.

The attack pattern is sometimes referred to internally as the **"puppet" attack**: the interface **showed signers one transaction** while **silently altering the data that was actually signed and executed**. Signers believed they were approving a routine cold-to-hot transfer; the modified payload effectively handed control to the attacker.

This post summarizes **targeted security improvements Safe{Wallet} shipped after the 21 February 2025 attack**, starting with the emergency [**v1.51.0**](https://github.com/safe-global/safe-wallet-monorepo/releases/tag/v1.51.0) release on **24 February 2025** and the hardening that followed through 2025 and into 2026.

**Scope of this article:** We include changes that directly address—or extend—the same failure mode: *compromised or dishonest frontend code misleading signers about transaction content*. We do **not** catalogue every security-related commit in the monorepo (for example, general mobile WalletConnect fixes or unrelated permission hardening). Those matter, but they belong in a separate platform-security overview.

---

## What the attack exploited

Understanding the fixes requires a clear picture of the failure mode:

1. **Supply-chain compromise** — Attackers gained access to Safe{Wallet} build/deploy infrastructure (initially via a compromised developer workstation) and injected malicious JavaScript into assets served to users.
2. **Targeted activation** — The payload was designed to remain dormant unless specific wallet conditions were met, reducing the chance of early detection.
3. **UI vs. reality mismatch** — When Bybit signers initiated a legitimate operation on **21 February 2025**, the malicious script **modified transaction parameters** (including operation type) *before* hardware wallets and human reviewers could verify the true intent.
4. **Rapid cleanup** — Forensic timelines show malicious assets were removed from infrastructure within minutes of execution, complicating post-incident analysis.

The lesson is blunt: **even perfect multisig policy and hardware wallets cannot save you if the application layer lies about what is being signed.**

Safe{Wallet}'s response combined **immediate client-side mitigations**, **dependency and infrastructure hardening**, and a **sustained program of pre-sign review** (Safe Shield, Security Hub, Hypernative Guard integration).

---

## Phase 1: Emergency release [v1.51.0](https://github.com/safe-global/safe-wallet-monorepo/releases/tag/v1.51.0) (24 February 2025)

Version [**v1.51.0**](https://github.com/safe-global/safe-wallet-monorepo/releases/tag/v1.51.0) was a focused security release. Each change maps directly to lessons from the incident.

### 1. MITM validation — `safeTxHash` must match `txData`

**Problem addressed:** An attacker who controls frontend JavaScript can present benign transaction details while submitting a different payload to the signing stack.

**What we shipped:** Client-side validation that:

1. **Recomputes the Safe transaction hash** from the displayed transaction data and compares it to the expected `safeTxHash`.
2. **Re-validates existing ECDSA signatures** on the transaction (where applicable), so tampering with an already-collected signature is also caught before you add yours.

If either check fails, signing and execution are blocked with an explicit error.

**Why it matters:** This is the closest thing to a direct antidote for "puppet" UI attacks. Signers and automated flows can no longer proceed when the hash and the human-readable fields disagree—regardless of whether the mismatch came from malware, a compromised CDN, or a buggy intermediary.

**Status today:** ✅ **Active.** The `useValidateTxData` hook is wired into Sign, Execute, and batch submission flows.

---

### 2. Removing `eth_sign` blind-signing fallback

**Problem addressed:** Legacy signing paths that do not bind signatures to structured, human-verifiable transaction data increase the blast radius of UI manipulation.

**What we shipped:** Removal of the outdated **`eth_sign` fallback** for Safe transaction signing. The application now relies on **`eth_signTypedData`** / EIP-712 structured data, which is the appropriate path for modern Safe versions.

**Why it matters:** Blind signing makes it easier for a compromised UI to trick a wallet into signing opaque payloads. Structured signing raises the bar for silent substitution.

**Status today:** ✅ **Active.** Off-chain Safe signing uses `ETH_SIGN_TYPED_DATA` exclusively in the transaction sender SDK path.

> **Note:** Hardware wallet modules may still expose `eth_sign` at the RPC layer for compatibility with the device API. That is distinct from the Safe signing fallback that was removed.

---

### 3. Transaction notes — additional client-side sanitization

**Problem addressed:** User-supplied metadata (transaction notes stored in `origin` JSON) is another injection surface if rendered unsafely or passed through multiple systems.

**What we shipped:** **Client-side HTML stripping** for transaction notes, complementing existing backend sanitization.

**Why it matters:** Defense in depth. Even if one layer fails, the client refuses to attach obviously malicious markup to transaction metadata.

**Status today:** ✅ **Active** in `encodeTxNote`.

---

### 4. Forcing a patched `elliptic` dependency

**Problem addressed:** Known vulnerabilities in transitive cryptographic dependencies can undermine signature validation and key operations across the JavaScript ecosystem.

**What we shipped:** Yarn resolution pinning **`elliptic` to ^6.6.1** via `@ethersproject/signing-key`.

**Status today:** ✅ **Active** in root `package.json` resolutions.

---

### 5. Full raw calldata in advanced transaction details ([#5102](https://github.com/safe-global/safe-wallet-monorepo/pull/5102))

**Problem addressed:** Signers reviewing only decoded, summarized views may miss subtle calldata substitutions—exactly the class of change used in sophisticated frontend attacks (for example, swapping a `CALL` for a `DELEGATECALL` in the bytes actually signed).

**What we shipped:** The transaction flow **advanced details** panel exposes **complete raw calldata** via expandable hex views, so reviewers are not limited to abridged summaries.

**Status today:** ⚠️ **Partially evolved.** Full hex is available on demand ("Show more"); the default receipt view still truncates long payloads for readability.

### 5b. Independent hash verification — Safe Utils ([#5147](https://github.com/safe-global/safe-wallet-monorepo/pull/5147))

**Problem addressed:** Even a honest UI is not a substitute for **out-of-band verification**. Treasury teams need to recompute hashes outside the application that serves the transaction.

**What we shipped:** The confirmation flow links to **[OpenZeppelin Safe Utils](https://safeutils.openzeppelin.com/)** so signers can cross-check `safeTxHash` and transaction fields in a separate tool.

**Status today:** ✅ **Active** — linked from the transaction confirmation receipt and called out in signer guidance below.

---

### 6. Temporary removal of hardware wallet modules

**Problem addressed:** During incident triage, Ledger/Trezor integration code paths and their dependency tree required urgent review before we could certify they were safe to ship.

**What we shipped:** A **temporary removal** of Ledger and Trezor modules in [v1.51.0](https://github.com/safe-global/safe-wallet-monorepo/releases/tag/v1.51.0).

**Status today:** ❌ **Reversed.** Ledger support returned in **April 2025** ([#5377](https://github.com/safe-global/safe-wallet-monorepo/pull/5377)); Trezor was re-enabled in **March 2026** ([#7077](https://github.com/safe-global/safe-wallet-monorepo/pull/7077)), with expanded test coverage and hash-comparison UX for Ledger signing.

---

## Phase 2: Immediate follow-ups (late February – March 2025)

The [v1.51.0](https://github.com/safe-global/safe-wallet-monorepo/releases/tag/v1.51.0) release was the floor, not the ceiling.

| Improvement | Intent | Status |
|---|---|---|
| **Blockaid: pass dApp origin** ([#5114](https://github.com/safe-global/safe-wallet-monorepo/pull/5114)) | Give simulation/scoring engines accurate caller context | ✅ Active |
| **Blockaid: `non_dapp: true` for non-dApp flows** ([#5129](https://github.com/safe-global/safe-wallet-monorepo/pull/5129)) | Reduce false negatives when origin metadata is absent | ✅ Active |
| **Untrusted fallback handler warnings** ([#4877](https://github.com/safe-global/safe-wallet-monorepo/pull/4877)) | Flag proxy/fallback contracts that are not on the known-safe list | ✅ Evolved into Safe Shield + Security Hub scanners |
| **Third-party hash validation (Safe Utils)** ([#5147](https://github.com/safe-global/safe-wallet-monorepo/pull/5147)) | Let signers independently recompute hashes outside the app | ✅ Active — linked from the confirmation receipt |
| **Validated Safe address from URL** ([#5168](https://github.com/safe-global/safe-wallet-monorepo/pull/5168)) | Prevent loading arbitrary addresses from tampered deep links | ✅ Active via `useSafeAddressFromUrl` |
| **CSP tightening** ([#5201](https://github.com/safe-global/safe-wallet-monorepo/pull/5201)) | Reduce XSS blast radius | ⚠️ Partially rolled back for analytics ([#5339](https://github.com/safe-global/safe-wallet-monorepo/pull/5339) reintroduced `unsafe-inline` for GA) |
| **Subresource Integrity (SRI) for dynamic chunks** ([#5199](https://github.com/safe-global/safe-wallet-monorepo/pull/5199), [#7026](https://github.com/safe-global/safe-wallet-monorepo/pull/7026)) | Detect tampered JavaScript bundles at load time | ✅ Active — webpack SRI manifest plugin |
| **Blockaid simulation on confirmation** ([#5203](https://github.com/safe-global/safe-wallet-monorepo/pull/5203)) | Surface simulation results before sign/execute | ✅ Evolved into Safe Shield widget |
| **Production-only security banner** ([#5170](https://github.com/safe-global/safe-wallet-monorepo/pull/5170)) | Surface signing-risk messaging on production | ❌ Removed — see below |
| **Security banner removed** ([#5384](https://github.com/safe-global/safe-wallet-monorepo/pull/5384), Mar 2025) | Retired global banner in favor of in-flow review | Superseded by Safe Shield / confirmation UX |

---

## Phase 2b: Bundle integrity, modules, and batched transactions

These changes extend the same lesson—**do not trust a single rendering of transaction intent**—to deployment artifacts and complex call patterns.

### Subresource Integrity (SRI) for application JavaScript

**Problem addressed:** If an attacker can replace files in storage or on the wire, they can reintroduce a "puppet" script even after infrastructure is rebuilt.

**What we shipped:** SRI hashes for dynamically loaded webpack chunks ([#5199](https://github.com/safe-global/safe-wallet-monorepo/pull/5199), later reinforced in [#7026](https://github.com/safe-global/safe-wallet-monorepo/pull/7026)), so the browser refuses to execute bundles that do not match the expected digest.

**Status today:** ✅ **Active** — `sri-manifest-webpack-plugin` patches the webpack runtime to set `integrity` on lazy-loaded scripts.

### Content Security Policy (CSP)

**Problem addressed:** XSS in the app surface could reinject signing-layer manipulation.

**What we shipped:** Tighter `script-src` in [#5201](https://github.com/safe-global/safe-wallet-monorepo/pull/5201).

**Status today:** ⚠️ **Partially rolled back** — [#5339](https://github.com/safe-global/safe-wallet-monorepo/pull/5339) reintroduced `'unsafe-inline'` for Google Analytics. CSP still constrains many vectors, but inline script policy is a known trade-off.

### Untrusted fallback handler — single transactions and MultiSend

| Change | PR | Intent |
|---|---|---|
| First-line warnings for unknown fallback handlers | [#4877](https://github.com/safe-global/safe-wallet-monorepo/pull/4877) | Alert when proxy/fallback is not on the known-safe list |
| Same checks inside **MultiSend** batches | [#5756](https://github.com/safe-global/safe-wallet-monorepo/pull/5756) | Close the batching loophole—attackers often hide malicious calls inside aggregated transactions |
| Pre-sign check in Safe Shield | [#6902](https://github.com/safe-global/safe-wallet-monorepo/pull/6902) | Flag **unofficial** fallback handlers during transaction review |

**Status today:** ✅ **Active** across warnings, Shield, and Security Hub scanners.

### Master copy and factory provenance

**Problem addressed:** A malicious or outdated implementation/factory pairing can change what "a Safe transaction" means at the contract layer—orthogonal to UI puppetry, but part of holistic treasury assurance after the incident.

**What we shipped:**

- Restored **master copy warnings** on the dashboard Action Required panel ([#7250](https://github.com/safe-global/safe-wallet-monorepo/pull/7250), after a brief revert in [#7249](https://github.com/safe-global/safe-wallet-monorepo/pull/7249)).
- **Security Hub** scanners for factory validation, implementation version, and L2 master copy staleness ([#7839](https://github.com/safe-global/safe-wallet-monorepo/pull/7839), [#7898](https://github.com/safe-global/safe-wallet-monorepo/pull/7898)).

**Status today:** ✅ **Active** — dashboard warnings and Hub scans complement each other.

### Production security messaging (retired)

After [v1.51.0](https://github.com/safe-global/safe-wallet-monorepo/releases/tag/v1.51.0), we briefly showed a **production-only security banner** ([#5170](https://github.com/safe-global/safe-wallet-monorepo/pull/5170)) to reinforce signing hygiene. In **March 2025** it was **removed** ([#5384](https://github.com/safe-global/safe-wallet-monorepo/pull/5384)) in favor of in-context review (Safe Utils links, expandable calldata, later Safe Shield)—avoiding alert fatigue while keeping controls at the point of signing.

---

## Phase 3: Pre-sign review and account posture (2025–2026)

### Safe Shield — proactive transaction review

Starting in late 2025, **Safe Shield** became the primary pre-signing security surface:

- **Recipient and contract counterparty analysis**
- **Blockaid-powered threat simulation** (when Guard is not blocking the path)
- **Hypernative Guard integration** for protected Safes
- **Mandatory risk acknowledgment** for critical-severity findings — evolved from the earlier "disable Continue until Blockaid warning confirmed" pattern ([#5744](https://github.com/safe-global/safe-wallet-monorepo/pull/5744))
- **Off-chain message signing** coverage ([#6748](https://github.com/safe-global/safe-wallet-monorepo/pull/6748))
- **EIP-712 typed message analysis** ([#7409](https://github.com/safe-global/safe-wallet-monorepo/pull/7409))
- **Nested `approveHash` transaction threat merging** ([#6858](https://github.com/safe-global/safe-wallet-monorepo/pull/6858), after a brief revert in [#6855](https://github.com/safe-global/safe-wallet-monorepo/pull/6855) and re-merge)

**Blockaid accuracy improvements** (same threat model—wrong simulation input can hide a malicious transaction):

| Change | PR | Why it matters after 21 Feb |
|---|---|---|
| Pass correct **dApp origin** to Blockaid | [#5114](https://github.com/safe-global/safe-wallet-monorepo/pull/5114), [#7663](https://github.com/safe-global/safe-wallet-monorepo/pull/7663) | Simulation must reflect who invoked the transaction |
| Parse **Safe App origin JSON** before sending to Blockaid | [#6400](https://github.com/safe-global/safe-wallet-monorepo/pull/6400) | Prevents malformed or spoofed origin metadata from skewing results |
| **`non_dapp: true`** when no dApp context exists | [#5129](https://github.com/safe-global/safe-wallet-monorepo/pull/5129) | Avoids silent simulation skips on non–Safe App flows |
| **Temporarily disable Guard** during Blockaid simulation | [#6501](https://github.com/safe-global/safe-wallet-monorepo/pull/6501), [#5956](https://github.com/safe-global/safe-wallet-monorepo/pull/5956) | Stops Guard from masking simulation output; simulation uses zero-address guard override where needed |

Safe Shield encodes a product principle: **speed bumps are a feature, not friction.**

### Security Hub — account-level posture (2026)

In May 2026, **Security Hub** launched as a Space-level dashboard scanning Safes for:

- Suboptimal signer/threshold configuration
- Outdated master copy versions (including L2 deployments)
- Untrusted fallback handlers and factory provenance
- Missing recovery modules
- Guard deployment recommendations

One deliberate omission: **signer screening via Blockaid** was temporarily removed ([#7895](https://github.com/safe-global/safe-wallet-monorepo/pull/7895)) because the backend endpoint was not yet production-ready—shipping a "Clear" grade while individual signers showed "Screening unavailable" was misleading. The checks matrix documents this as **planned**, not forgotten.

**Post-launch Hub hardening** (still incident-aligned—accurate posture signals prevent false confidence after a trust shock):

| Fix | PR | Intent |
|---|---|---|
| Strict majority rule in account-setup scoring | [#7894](https://github.com/safe-global/safe-wallet-monorepo/pull/7894) | Correct threshold/signers grading |
| Consistent **$1M balance** threshold for guard recommendations | [#7893](https://github.com/safe-global/safe-wallet-monorepo/pull/7893) | Align advice with documented policy |
| Stable score + hardened re-scan | [#7933](https://github.com/safe-global/safe-wallet-monorepo/pull/7933) | Prevent flickering grades between scans |
| Gauge no longer flips during scan | [#7874](https://github.com/safe-global/safe-wallet-monorepo/pull/7874) | UX trust in the score itself |

### Session and access control

Session handling is peripheral to the puppet attack but part of **reducing unauthorized use of a recovered or shared browser** after the industry-wide security reset:

- Session expiry is handled by **`useSessionExpiryGuard`**: clears auth state, shows a toast, and probes `/v1/auth/me` — replacing an earlier forced-redirect approach that was reverted as too disruptive.
- **Spaces login gating** ([#7884](https://github.com/safe-global/safe-wallet-monorepo/pull/7884)) ensures unauthenticated users cannot reach wallet operations without an explicit workspace context.

### Infrastructure and release integrity

Post-incident, Safe{Wallet} publicly committed to **rebuilding infrastructure**, **rotating credentials**, and tightening release processes. In the codebase this manifests as:

- **GPG-signed release and back-merge commits** ([#6772](https://github.com/safe-global/safe-wallet-monorepo/pull/6772), [#7943](https://github.com/safe-global/safe-wallet-monorepo/pull/7943))
- **CI permission hardening** and **`/version.json` exposure** for deploy verification ([#7918](https://github.com/safe-global/safe-wallet-monorepo/pull/7918))
- **Artifact attestation** in CI ([#5133](https://github.com/safe-global/safe-wallet-monorepo/pull/5133))

---

## What signers should do today

Technical controls help, but **operational discipline** remains essential—especially for high-value cold-wallet operations:

1. **Cross-verify hashes** — Use [Safe Utils](https://safeutils.openzeppelin.com/) or equivalent tooling to recompute `safeTxHash` independently of the UI you are staring at.
2. **Expand raw calldata** — Do not sign based on decoded summaries alone; inspect full hex for delegate calls and unexpected selectors.
3. **Treat simulation warnings as blocking** — Acknowledge and investigate critical Safe Shield / Blockaid findings before proceeding.
4. **Verify deploy provenance** — Compare the app version you are running against official release channels; SRI and CSP reduce but do not eliminate supply-chain risk.
5. **Segregate signing environments** — Dedicated machines, network isolation, and hardware wallets with **clear-signing** enabled remain best practice for treasury operations.

---

## Timeline at a glance

| Date | Event |
|---|---|
| **4 Feb 2025** | Earliest indicators of developer workstation compromise (per Mandiant reporting cited in industry analyses) |
| **19 Feb 2025** | Malicious JavaScript reported in Safe frontend deployment assets |
| **21 Feb 2025** | Bybit cold-wallet operation intercepted; ~$1.4B stolen |
| **24 Feb 2025** | [**v1.51.0**](https://github.com/safe-global/safe-wallet-monorepo/releases/tag/v1.51.0) emergency security release |
| **25 Feb – Mar 2025** | Blockaid origin fixes, Safe Utils link, CSP/SRI, validated address parsing, security banner retired |
| **May 2025** | MultiSend untrusted-fallback warnings ([#5756](https://github.com/safe-global/safe-wallet-monorepo/pull/5756)) |
| **Late 2025** | Safe Shield widget; Blockaid must-confirm → risk acknowledgment ([#5744](https://github.com/safe-global/safe-wallet-monorepo/pull/5744)) |
| **Jan–Mar 2026** | SRI reinforcement ([#7026](https://github.com/safe-global/safe-wallet-monorepo/pull/7026)), EIP-712 Shield analysis ([#7409](https://github.com/safe-global/safe-wallet-monorepo/pull/7409)), Trezor re-enabled ([#7077](https://github.com/safe-global/safe-wallet-monorepo/pull/7077)) |
| **May 2026** | Security Hub launch ([#7839](https://github.com/safe-global/safe-wallet-monorepo/pull/7839)) + scoring fixes ([#7893](https://github.com/safe-global/safe-wallet-monorepo/pull/7893)–[#7895](https://github.com/safe-global/safe-wallet-monorepo/pull/7895), [#7933](https://github.com/safe-global/safe-wallet-monorepo/pull/7933), [#7874](https://github.com/safe-global/safe-wallet-monorepo/pull/7874)) |

---

## Closing thoughts

The February 2025 incident was a **supply-chain and frontend integrity** failure, not a Safe smart-contract vulnerability. The industry's takeaway should be uncomfortable but simple:

> **Multisig does not protect you from an application that lies.**

Safe{Wallet}'s post-incident work prioritized **detecting lies**—hash consistency checks, structured signing, independent verification tooling, simulation-backed review, and release integrity—while rebuilding the trust assumptions around how frontend artifacts reach users.

We will continue publishing technical summaries as major security milestones ship. If you operate a treasury Safe, treat this post as a checklist, not history.

---

## References

- [DL News — Sygnia investigation summary](https://www.dlnews.com/articles/defi/safe-wallet-compromise-behind-bybit-hack/)
- [The Defiant — Third-party audit findings](https://thedefiant.io/news/hacks/safe-wallet-found-responsible-for-bybit-s-usd1-5-billion-hack)
- [TRM Labs — Bybit exploit analysis](https://www.trmlabs.com/resources/blog/the-bybit-hack-following-north-koreas-largest-exploit)
- [Safe{Wallet} v1.51.0 release](https://github.com/safe-global/safe-wallet-monorepo/releases/tag/v1.51.0)
- [OpenZeppelin Safe Utils](https://safeutils.openzeppelin.com/)

---

*Last updated: May 2026. Feature statuses reflect the [`dev`](https://github.com/safe-global/safe-wallet-monorepo/tree/dev) branch as of that date. This article is intentionally scoped to Safe{Wallet} changes tied to the February 2025 frontend-integrity incident—not an exhaustive security changelog.*
