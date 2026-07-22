# Class E — Clipboard hijack / address swap

**Category:** `clipboard-swap`
**Canonical example:** the classic clipboard-replacer malware logic, now
extension-delivered and context-aware (Unit42 / TokenToolHub 2026 wallet-drainer
analyses).
**Provenance:** illustrative — well-documented clipboard-replacer malware
category, not a single cited incident.
**Protects:** the destination address the user actually intends to pay.

## Rule

An extension must not silently mutate clipboard contents that look like a
crypto address, and must not read the clipboard outside an explicit
user-initiated copy/paste it owns. Clipboard access on a wallet/page-injecting
extension is high-risk by default.

## Canonical example

The extension holds `clipboardRead` / `clipboardWrite` (or content-script
access to `navigator.clipboard`). It listens for `copy`/`paste` events or polls
the clipboard, matches strings against crypto-address regexes (Ethereum
`0x[a-fA-F0-9]{40}`, Bitcoin `^(1|3|bc1)`, Solana base58, Tron `T...`), and at
the moment of paste swaps the value for an attacker address — often a **vanity
address sharing the first/last 4–6 characters** so a glancing check passes.

## Detect

1. **Manifest signal.** `clipboardRead` / `clipboardWrite` in permissions, or a
   content script with broad host access (it can reach `navigator.clipboard` on
   the page). Disproportionate to stated purpose = investigate.
2. **Clipboard sinks/sources:**
   ```bash
   rg -n "navigator\.clipboard|clipboardData|execCommand\(['\"]copy|addEventListener\(['\"](copy|paste|cut)" --glob '*.{js,ts}'
   ```
3. **Address-shaped regex near a clipboard op.** A regex matching crypto
   address formats co-located with a clipboard read/write is the core tell:
   ```bash
   rg -n "0x\[a-fA-F0-9\]\{40\}|\[13\]\[a-km-zA-HJ-NP-Z1-9\]|\\bbc1|base58" --glob '*.{js,ts}'
   ```
4. **Mutation on event.** Confirm whether a `copy`/`paste` handler **writes
   back** a different value (`clipboardData.setData`, `navigator.clipboard.
   writeText`) than the user copied. Conditional replacement (only when the
   string matches an address) = finding.
5. **Vanity-match logic.** Code that compares/derives a replacement address by
   leading/trailing chars is strong intent evidence.

## Heuristic

*clipboard read/write capability AND an address-format regex AND a write-back
that substitutes a matched address (especially prefix/suffix-preserving) →
"clipboard address-swap drainer."*

## Notes

A wallet legitimately offers "copy my address" — that's a one-way write the
user triggered. The finding is **reading** page/clipboard addresses and/or
**overwriting** them. Distinguish first-party "copy receive address" from
silent substitution of an arbitrary copied address.
