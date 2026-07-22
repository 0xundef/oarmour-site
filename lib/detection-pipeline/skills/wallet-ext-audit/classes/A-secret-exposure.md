# Class A — Secret rendered/stored in a recoverable place

**Category:** `secret-exposure`
**Canonical example:** MetaMask "Demonic", CVE-2022-32969
**Provenance:** public CVE (CVE-2022-32969); first-party source provided (the
MetaMask static-audit writeup supplied by the operator).
**Protects:** the seed / private key at rest in the browser.

## Rule

High-sensitivity secrets (seed phrase, private key, vault password) must never
live in a place the OS, the browser, or another process can persist or read.
Correct in-memory handling is not enough if the value lands in a disk-backed
surface.

## Canonical example

A 12/24-word mnemonic shown in a plain `type="text"` input. Browsers persist
text-input contents to disk via session-restore / tab-recovery in plaintext,
so the seed is recoverable by anyone with disk access — **even after the
extension is uninstalled**. The bug was not "the seed was displayed" but "the
seed was displayed in a field the browser caches to disk."

## Detect

1. **Taint sources** = the seed/key tokens (`mnemonic`, `seedPhrase`, `srp`,
   `privateKey`, `entropy`, `exportAccount` output).
2. **Rendering sinks — check the field type:**
   ```bash
   rg -n "type=['\"]text['\"]" --glob '*.{js,jsx,ts,tsx,html}'
   ```
   Flag any element bound to a secret source whose `type` is not `password`,
   plus `contentEditable`, `value={mnemonic}`, `dangerouslySetInnerHTML` /
   `innerHTML` fed secret-tainted data.
3. **Positive controls whose ABSENCE is the finding:**
   `autocomplete="off"`, `spellcheck="false"`, `value` cleared on unmount
   (`setMnemonic('')`), no copy-to-clipboard of the raw seed left dangling.
4. **Secret lifetime → storage.** Trace the secret into `localStorage` /
   `sessionStorage` / `chrome.storage.local` / IndexedDB. Secret persisted
   unencrypted, written before encryption, or never zeroed = finding.
   ```bash
   rg -n "localStorage|sessionStorage|chrome\.storage|indexedDB" --glob '*.{js,ts}'
   ```
5. **Logging/console leak.** Secret-tainted value reaching `console.log`,
   `console.error`, or a debug buffer is the same bug class (recoverable via
   devtools / log files).

## Heuristic

*secret-tainted value → DOM input/contentEditable AND (type != password OR no
masking), OR secret-tainted value → storage/log without encryption/zeroing →
"secret in a browser-cacheable place."*

## Notes for compiled bundles

JSX/`type` attributes survive into the rendered output; grep the de-obfuscated
bundle for the input-type strings and read backward to the bound state
variable. If only beautified (not unpacked), flag as "needs manual
confirmation" per `chrome-ext-audit` SKILL.md §6 (confidence discipline).
