# Class F — Transaction parameter / recipient tampering

**Category:** `tx-tampering`
**Canonical example:** injected-script swaps at execution time — the chalk/debug
npm drainer pattern (recipient replaced while UI shows the intended one) and
content-script DOM rewrites bundling a hidden approval.
**Provenance:** public incident (Sept 2025 chalk/debug npm compromise);
added from the incident corpus — verify against the primary writeup.
**Protects:** the integrity of the transaction between user intent and signing.

## Rule

The transaction the user reviews must be the transaction that gets signed. No
code path between the dApp/UI and the keyring may rewrite `to`, `value`, `data`,
or inject an additional approval the user did not see.

## Canonical example

Two shapes:
- **Recipient/value swap at execution time.** Malware hooks `window.ethereum`,
  `fetch`, and `XMLHttpRequest`; when an `eth_sendTransaction` flows through, it
  replaces the `to` address (or rewrites the response/DOM) while the UI keeps
  showing the legitimate destination. With a hot wallet the user has no
  independent view of what was actually signed.
- **Hidden bundled approval.** An injected content script adds an `approve(` /
  `setApprovalForAll` (often `unlimited`) to the user's intended Uniswap-style
  swap so the wallet shows one normal interaction; the victim signs, and the
  attacker contract silently gains drain rights for later.

## Detect

1. **Interception of the request path:**
   ```bash
   rg -n "window\.ethereum|\.request\(|eth_sendTransaction|fetch\s*=|XMLHttpRequest\.prototype|Object\.defineProperty\(.*ethereum" --glob '*.{js,ts}'
   ```
   Flag code that **reassigns/overrides** `window.ethereum`, `fetch`, or
   `XMLHttpRequest.prototype.*`, or wraps `provider.request`.
2. **Mutation of tx fields.** Inside any request wrapper, look for writes to
   `to`, `value`, `data`, `gas`, or substitution of an address literal before
   the call reaches the keyring. A request handler that **edits** params (vs
   forwarding them) = finding.
3. **Injected approvals.** Search for `approve(` / `setApprovalForAll` /
   `permit` constructed by extension code (not the dApp) and appended to a
   user-initiated flow, especially with max/`unlimited` amounts.
4. **UI vs signed mismatch.** Where feasible, confirm the value rendered in the
   confirmation view is the same object passed to `signTransaction` — a
   divergence (display reads one source, signer reads another) is the bug.
5. **Content-script DOM rewrite of addresses/buttons.** `innerHTML` /
   `textContent` writes that replace displayed addresses or repoint
   "Confirm"/"Approve" handlers.

## Heuristic

*extension code overrides `window.ethereum`/`fetch`/`XHR` or the provider
request path AND mutates `to`/`value`/`data` or injects an `approve`/`permit`
not present in the user's intent → "transaction tampering / hidden approval."*

## Defense note (for the report)

The structural fix users have is a **hardware wallet** — it displays the actual
destination on its own screen, defeating DOM/provider-layer tampering. Note
this in findings where the extension is the sole confirmation surface.
