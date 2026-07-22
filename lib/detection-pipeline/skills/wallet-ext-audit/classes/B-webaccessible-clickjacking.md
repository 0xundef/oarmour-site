# Class B — Over-exposed web-accessible page → clickjacking

**Category:** `clickjacking`
**Canonical example:** MetaMask `phishing.html` web-accessible page
**Provenance:** public advisory / bug bounty; first-party source provided (the
MetaMask static-audit writeup supplied by the operator).
**Protects:** what the user is induced to confirm (UI-redress on wallet views).

## Rule

Any extension HTML page reachable by web origins must not be framable and must
not expose redirect or state-change primitives to untrusted callers.

## Canonical example

A warning page listed in `web_accessible_resources`, so any HTTPS page could
`iframe` it. Combined with an open redirect that accepted `chrome-extension://`
targets from a query parameter, it became a gateway to overlay / UI-redress the
wallet's confirmation views — the attacker frames a transparent wallet
confirmation over a decoy button.

## Detect

1. **Enumerate `web_accessible_resources` in `manifest.json`.** Flag any
   **interactive HTML page** (not just `inpage.js` / images).
   - MV2: any HTML in the flat array is web-reachable.
   - MV3: missing `matches` allowlist, or `<all_urls>` / `*://*/*` on an HTML
     page = finding.
2. **For each exposed page, confirm anti-framing:** CSP `frame-ancestors
   'none'`, `X-Frame-Options: DENY`, or framebusting JS
   (`if (window.top !== window.self)`). Absence on an exposed page = finding.
3. **Find navigation sinks in the exposed page's script:**
   ```bash
   rg -n "location\.(href|assign|replace)|window\.open|chrome\.tabs\.create|runtime\.getURL" --glob '*.{js,ts}'
   ```
   Flag any fed from attacker-controllable input (`URLSearchParams`,
   `location.hash`, `href` query param) with **no scheme/host allowlist**.
   Accepting `chrome-extension://` from untrusted input = finding (the gateway
   primitive).
4. **Flag exposed pages that mutate state** — add to allowlist, open
   confirmation views, `runtime.sendMessage` that triggers privileged action.
   That's what a clickjacker monetizes.

## Heuristic

*manifest exposes HTML in `web_accessible_resources` AND (no `matches`
allowlist OR `all_urls`) AND (no `frame-ancestors` OR has redirect/state
sinks) → "clickjackable web-accessible page."*

## Notes

The manifest is plaintext — audit it first, it bounds the worst case. An
exposed image or `inpage.js` alone is low-risk; the finding is an exposed
*interactive* page that can be framed AND can change state or redirect.
