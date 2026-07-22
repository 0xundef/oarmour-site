# Class L — Dependency supply-chain (bundled package backdoor)

**Category:** `supply-chain`
**Canonical example:** the Sept 2025 chalk/debug npm compromise — 18+ packages
(~2B weekly downloads) injected with a browser crypto-drainer that hooked
`fetch`, `XMLHttpRequest`, and `window.ethereum`; `npmjs.help` maintainer
phishing.
**Provenance:** public incident (Sept 2025 chalk/debug npm compromise); added
from the incident corpus — verify against the primary writeup.
**Protects:** the wallet from malicious code riding in a third-party dependency.

## Rule

A bundled dependency runs in the same JS context as the wallet and can hook the
same APIs. Treat third-party code in the bundle as part of the attack surface:
a dep that touches wallet/network globals it has no business touching is a
finding, independent of first-party code quality.

## Canonical example

Attackers phished an npm maintainer and pushed malicious versions of ubiquitous
low-level packages (chalk, debug, color-convert, ansi-styles…). The injected
payload, deep in the dependency tree, detected `window.ethereum`, hooked
`fetch()` / `XMLHttpRequest` to monitor traffic, and swapped wallet addresses /
transaction params at execution time — silent because the UI still rendered the
intended values. Developers pulled it transitively without noticing.

## Detect

1. **Globals touched by dependency code.** In the unpacked bundle (webcrack
   per-module), look for **utility/styling modules that reference wallet or
   network globals** they shouldn't:
   ```bash
   rg -n "window\.ethereum|eth_sendTransaction|XMLHttpRequest\.prototype|fetch\s*=|Object\.defineProperty\(.*(ethereum|fetch)" --glob '*.{js,ts}'
   ```
   A logging/color/string lib reaching for `window.ethereum` = strong tell.
2. **Hook installation.** Reassignment/wrapping of `fetch`, `XHR.prototype.*`,
   or `window.ethereum` from within a vendored module (cross-ref Class F for
   the tx-tampering payload itself).
3. **Address-shaped constants / regex in a dependency** (cross-ref Class E)
   far from any wallet feature.
4. **Version provenance.** Diff `package-lock`/bundled dep versions against
   known-good; flag a dep version added/bumped right before the suspicious
   behavior appeared, or a transitive dep pinned to an off-band version. A
   release whose only change is a dependency bump + new network behavior is the
   supply-chain shape.
5. **Lookalike maintainer/registry signals** (out of band): packages installed
   from odd registries, or postinstall scripts — note even if not statically
   provable in the shipped bundle.

## Heuristic

*a third-party/vendored module references wallet or network globals
(`window.ethereum`, `fetch`/`XHR` override, address regex) unrelated to its
stated purpose, OR a dependency bump coincides with new
exfil/tampering behavior → "dependency supply-chain backdoor."*

## Notes

Distinguish from Class D (first-party telemetry backdoor): same outcome (off-
device exfil / tampering), different origin (a dep vs the vendor's own code).
The audit move is module-level attribution — *which* module in the unpacked
bundle does the bad thing, and is it first-party or vendored. Cite by webpack
module id per `chrome-ext-audit` SKILL.md §5 (citing findings).
