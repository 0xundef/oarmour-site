# Class D — Seed exfiltration via disguised telemetry / supply-chain backdoor

**Category:** `supply-chain`
**Canonical example:** Trust Wallet browser-extension v2.68 (Dec 2025), seed
exfil to `api.metrics-trustwallet[.]com` via PostHog `capture()`
**Provenance:** public incident (Trust Wallet v2.68, Dec 2025); first-party
source provided (the BlockSec writeup supplied by the operator).
**Protects:** the decrypted seed/key while it briefly exists in memory.

## Rule

Decrypted secret material must stay on-device. Any path that carries it
off-device — including channels that *look* legitimate (telemetry, logging,
crash reporting) — is a critical leak. Correct encryption-at-rest does **not**
cover the window where the secret is decrypted in memory during unlock.

## Canonical example

A backdoor shipped via a **supply-chain compromise**: a leaked Chrome Web Store
API key let the attacker push a build straight to the store, bypassing internal
review. Inside the **unlock flow**, right after legitimate auth, the code walked
every wallet, grabbed the **decrypted** seed phrase, stashed it in a
deceptively named variable (`errorMessage`), embedded it in an analytics
`error` field, and let an analytics SDK's `capture()` pipeline batch + gzip +
POST it to a lookalike domain mimicking the vendor's real analytics host. The
secret rode out on a path that looks like normal telemetry — no obvious
`fetch(seed)`.

## Detect

1. **Treat analytics/telemetry SDKs as network sinks.** PostHog `capture()`,
   Segment, Sentry, Amplitude, Mixpanel, GA `gtag` all egress off-device.
   Don't only look for `fetch`/`XHR` — the exfil channel is the SDK.
   ```bash
   rg -n "posthog|capture\(|Sentry|analytics|segment|amplitude|mixpanel|gtag" --glob '*.{js,ts}'
   ```
2. **Secret → telemetry taint.** Trace decrypted seed/key material into ANY
   analytics call, event object, or log/error payload. A secret reaching a
   `capture`/`track`/`log`/`error` argument is a finding regardless of the
   field name. Watch for **semantic mismatch**: secret-tainted data assigned
   to fields named `error`, `errorMessage`, `event`, `meta`, `props`.
3. **Telemetry on the post-auth path.** Any analytics/network call placed
   inside `unlock` / `decrypt` / `submitPassword` / biometric verify is
   high-risk — that's the one moment plaintext secrets exist in memory.
4. **Lookalike / unexpected destination domains.** Extract every network +
   analytics host literal and compare against the vendor's real domains. Flag
   brand-adjacent typosquats (`metrics-trustwallet.com` vs `trustwallet.com`)
   and any analytics host introduced/changed versus the prior version.
5. **Provenance signals.** Backdoors ship via the build pipeline: a release
   whose only diff is "added a network/analytics destination + a hook on the
   unlock/decrypt path" is the classic supply-chain-backdoor shape. When
   version-diffing is available, diff the unlock/decrypt modules and the
   analytics/network config across versions.

## Heuristic

*decrypted seed/key material is data-flow-reachable from a
telemetry/analytics/log sink (`capture`/`track`/`log`/`error`), OR a
network/analytics destination host is a lookalike of / divergent from the
vendor's real domain, OR an analytics call sits on the unlock/decrypt path →
"seed exfiltration via disguised telemetry."*

## Related

For exfil via a **bundled third-party dependency** (rather than first-party
backdoor code), see Class L. For the **distribution mechanism** (OAuth/API-key
hijack pushing the malicious build), the audit signal is provenance/diff; the
in-code evidence is this class.
