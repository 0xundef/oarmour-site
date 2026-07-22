# Class K — Session / cookie auth-state theft

**Category:** `session-theft`
**Canonical example:** Cyberhaven-cluster extensions exfiltrating session
cookies + OAuth tokens (Dec 2024); info-stealer payloads shipping browser
cookie stores to C2 for exchange-account replay.
**Provenance:** public incident (Cyberhaven-cluster session exfil); added from
the incident corpus — verify against the primary writeup.
**Protects:** authenticated session state for exchanges / web wallets / dApps.

## Rule

An extension must not read authentication cookies or session/OAuth tokens and
send them off-device. Stolen session cookies let an attacker replay the logged-
in state from another network — **no password, no fresh 2FA**.

## Canonical example

A compromised/hostile extension with `cookies` permission (or content-script
`document.cookie` access on exchange/wallet domains) reads auth cookies and
OAuth access tokens for sites like exchanges, ChatGPT, or Facebook for Business
and POSTs them to a C2. The attacker imports the cookies elsewhere and is
logged in without triggering credential or 2FA checks.

## Detect

1. **Manifest signal.** `cookies` permission, broad `host_permissions` over
   exchange/wallet domains, or `<all_urls>` content scripts. Disproportionate
   to purpose = investigate.
2. **Cookie / token sources:**
   ```bash
   rg -n "chrome\.cookies|document\.cookie|cookies\.getAll|localStorage\.getItem|sessionStorage|authorization|bearer|access_token|refresh_token" --glob '*.{js,ts}'
   ```
3. **Source → network sink taint.** Trace cookie/token reads into `fetch` /
   `XMLHttpRequest` / `sendBeacon` / `WebSocket` / external message to a
   non-first-party origin. Cookie/token value embedded in a URL, header, or
   body to a third-party host = finding. (Delegate the trace to
   `ext-dataflow-tracer` if available.)
4. **Bulk harvest.** `cookies.getAll({})` with no domain filter, or iterating
   all storage keys, then exfil = high severity.
5. **Destination domains.** Extract host literals; flag C2 / typosquat /
   newly-introduced hosts (cross-ref Class D, H, I).

## Heuristic

*auth cookie / session-or-OAuth token is data-flow-reachable from a network
sink to a non-first-party origin (esp. bulk `getAll` or all-keys iteration) →
"session/cookie auth-state theft."*

## Notes

This overlaps `chrome-ext-audit/classes/B-data-exfiltration.md` and
`classes/F-privacy-tracking.md` (the generic classes); it's called out here
because for a wallet user the blast radius is
their exchange/custodial accounts, not just browsing privacy. First-party
session handling (the wallet's own auth to its own backend) is not the finding —
exfil to a third party is.
