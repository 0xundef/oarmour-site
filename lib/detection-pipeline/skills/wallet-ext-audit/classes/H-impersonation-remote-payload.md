# Class H — Impersonation + remote phishing payload (two-layer)

**Category:** `impersonation`
**Canonical example:** fake TronLink MV3 (SlowMist MistEye), Braavos/Ledger
Unicode-spoof samples (Unit42, May 2026), "Safery: Ethereum Wallet" fake
on-store wallet.
**Provenance:** public reports / samples (fake-wallet extensions); added from
the incident corpus — verify against the primary writeup.
**Protects:** users from a hostile extension masquerading as a real wallet.

## Rule

A wallet extension's identity (name, branding) must be what it claims, and its
UI must be served from its own packaged resources — not a remote page that can
swap to a credential-harvest form after store review.

## Canonical example

- **Unicode / brand spoofing.** The extension name uses `\u202E` (RIGHT-TO-LEFT
  OVERRIDE) so the Chrome Web Store renders it as "Ledger" or a reversed
  "Braavos…", and the description is peppered with `\u200B` zero-width spaces to
  defeat string-matching scanners.
- **Two-layer / remote payload.** The packaged extension looks benign and
  requests minimal permissions; on popup open it probes a C2 and loads a
  **remote iframe** that is a near-perfect clone of the real wallet, harvesting
  mnemonic / private key / keystore / password and exfiltrating via same-origin
  API to a Telegram bot or Cloudflare-Workers C2. When the C2 is offline it
  shows a decoy "secure" UI, so a static reviewer sees nothing malicious.

## Detect

1. **Name/description obfuscation:**
   ```bash
   rg -n "\\\\u202E|\\\\u200B|\\\\u200C|\\\\u200D|\\\\uFEFF" --glob '*.{json,js,ts,html}'
   ```
   Inspect `manifest.json` `name`/`default_title`/`description` byte-for-byte
   for RTL overrides, zero-width chars, and homoglyphs of known wallet brands.
2. **Remote-sourced UI.** Popup/options HTML that builds an `iframe`/`src` or
   `fetch`es a page from a remote origin instead of `runtime.getURL` packaged
   resources:
   ```bash
   rg -n "<iframe|\.src\s*=|createElement\(['\"]iframe|fetch\(['\"]https?://" --glob '*.{js,ts,html}'
   ```
   A wallet popup whose content comes from the network = strong finding.
3. **C2 reachability gate.** Behavior that branches on whether a remote host
   responds (decoy UI vs phishing UI) — see Class I for remote-config gating.
4. **Credential capture forms in/served by the extension** posting to a
   non-wallet origin, Telegram Bot API (`api.telegram.org/bot`), or a
   Workers.dev / typosquat host.
5. **Brand-vs-permissions/behavior mismatch.** Claims to be wallet X but the
   keyring/signing code is absent or thin while a remote form does the real
   work = impersonation shell.

## Heuristic

*manifest identity uses RTL/zero-width/homoglyph spoofing OF a known brand, OR
the wallet UI is loaded from a remote origin (esp. C2-gated) and posts secrets
off-origin → "impersonation + remote phishing payload."*

## Notes

This class often co-occurs with Class I (remote code/config) and Class K
(exfil destination). The static tells are: spoofed identity bytes, network-
sourced UI, and a decoy fallback. A "clean when C2 offline" sample is the
signature shape — flag the remote-UI dependency even if no payload is captured.
