# Class J — Insecure dApp messaging / provider injection

**Category:** `messaging`
**Canonical example:** unvalidated `onMessageExternal`/`externally_connectable`
handlers; `postMessage` bridges without origin checks; EIP-6963 provider
spoofing in the wallet-discovery flow.
**Provenance:** illustrative pattern from general extension-security knowledge,
not a single cited incident.
**Protects:** the trust boundary between web pages/dApps and the keyring.

## Rule

Every message crossing into the extension (from a web page, dApp, or another
extension) must have its sender/origin validated before it can reach a
privileged action, and the injected provider must not be spoofable by page
script into routing signing requests to an attacker.

## Canonical example

A wallet bridges page ↔ content script ↔ background via `window.postMessage`
and `runtime.sendMessage`. If the `postMessage` handler doesn't check
`event.origin` / `event.source`, or `onMessageExternal` doesn't validate
`sender`, a hostile page can invoke privileged methods (connect, request
accounts, trigger a signing prompt) as if it were a trusted caller. With
**EIP-6963** multi-provider discovery, a malicious page or co-installed
extension can `announceProvider` a look-alike to capture `eth_requestAccounts`
/ signing traffic.

## Detect

1. **External message entrypoints:**
   ```bash
   rg -n "onMessageExternal|onConnectExternal|externally_connectable|runtime\.onMessage|window\.addEventListener\(['\"]message" --glob '*.{js,ts,json}'
   ```
2. **Sender/origin validation present?** For each handler, confirm:
   - `postMessage`: checks `event.origin` against an allowlist AND
     `event.source === window` where appropriate.
   - `onMessageExternal`: validates `sender.id` / `sender.origin` /
     `sender.url`.
   - `externally_connectable` in manifest: narrow `matches`, not `<all_urls>`.
   Absence = finding.
3. **Privileged reach.** Trace whether an unvalidated message can reach a
   signing / account-export / approval / config-change path. The severity is
   set by what the message can trigger.
4. **Provider injection / EIP-6963:**
   ```bash
   rg -n "window\.ethereum|eip6963|announceProvider|requestProvider|defineProperty.*ethereum" --glob '*.{js,ts}'
   ```
   Flag provider injection that can be shadowed/overwritten by page script, or
   discovery handling that trusts an arbitrary announced provider for signing.
5. **Broad `externally_connectable` / `<all_urls>` content-script messaging**
   that lets any origin talk to the background.

## Heuristic

*a message from a page/dApp/external extension reaches a privileged
(signing/export/approval/config) action without sender/origin validation, OR
the injected provider/EIP-6963 discovery is spoofable by page script →
"insecure dApp messaging / provider injection."*

## Notes

Pair with `chrome-ext-audit/classes/D-insecure-messaging.md` (the generic
class) — here the
escalation target is specifically the keyring/signing surface, which raises
severity. A handler that only returns public state is low-risk; one that can
initiate a signature prompt or change networks/allowlists is the finding.
