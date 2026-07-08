# Class G — Supply chain

**Category:** `supply-chain`
**Canonical example:** an extension sold/transferred to a new owner (or pushed
via a stolen store API key) that ships an update injecting ads/malware; and
bundled third-party dependencies compromised upstream (npm) that hook
`fetch`/`XHR`/global objects.
**Provenance:** illustrative composite of real, well-documented categories
(extension ownership-transfer malware; npm upstream compromise) rather than one
named incident. Added in this session; not part of this skill's original
first-party basis.
**Protects:** the integrity of the shipped artifact across updates and its
bundled dependencies.

## Rule

The shipped bundle and its dependencies must be trustworthy across time, not
just at first review. Obfuscated payloads, suspicious bundled deps, behavior
that changes post-install, and version-to-version diffs that add network
destinations or hooks are supply-chain findings.

## Canonical example

An extension transferred to a new owner (or pushed via a stolen store API key)
ships an update injecting ads/malware; or a bundled npm dependency is
compromised upstream and hooks `fetch` / `XHR` / global objects.

## Detect

1. **Obfuscation as a signal.** obfuscator.io fingerprints (`_0x` ids, string-
   array decoder IIFE) in a "simple utility" extension warrant de-obfuscation
   and scrutiny (see SKILL.md preprocessing tiers).
2. **Bundled deps that touch sensitive globals:**
   ```bash
   rg -n "window\.ethereum|fetch\s*=|XMLHttpRequest\.prototype|Object\.defineProperty\(window" --glob '*.{js,ts}'
   ```
   A dependency hooking/overriding `fetch`/`XHR` or global objects is the
   classic injected-drainer/skimmer shape.
3. **Post-install behavior change.** Remote config / staged payload (overlaps
   Class C) that activates after store approval.
4. **Version diff (when available).** Diff against the prior version: a release
   whose only change is "added a network destination + a hook on a sensitive
   path" is the classic backdoor shape.
5. **New/lookalike destinations** introduced by an update — extract and
   compare host literals against the prior version and the vendor's real ones.

## Heuristic

*the bundle contains obfuscated/unexplained payloads, a bundled dep hooks
sensitive globals (`window.ethereum`/`fetch`/`XHR`), or a version diff adds a
network destination + a hook on a sensitive path → "supply-chain
compromise / injected payload."*

## Notes

Static analysis flags the *architecture* (remote dependence, hooks, new
destinations) without needing the live payload. Pair with Class C (remote
code) and Class B (exfiltration) for the full chain. Note fidelity if only
beautified.
