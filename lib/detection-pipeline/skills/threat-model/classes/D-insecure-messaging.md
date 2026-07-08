# Class D — Insecure messaging

**Category:** `messaging`
**Canonical example:** extensions with `onMessageExternal` handlers (or
`externally_connectable: ["*://*/*"]`) that act on messages without validating
the sender, letting any web page drive privileged extension actions.
**Provenance:** illustrative pattern from general extension-security knowledge —
not a single cited incident, and not part of this skill's original first-party
basis.
**Protects:** the trust boundary between untrusted web content and the
privileged extension context.

## Rule

Every inbound message crossing a privilege boundary must validate its origin
and sender before acting. A handler that trusts message content from any web
page (or any extension) is a confused-deputy primitive.

## Canonical example

An extension whose `onMessageExternal` handler (or
`externally_connectable: ["*://*/*"]`) acts on web-page messages without
validating the sender — any site can drive privileged extension actions
(confused deputy).

## Detect

1. **External message entrypoints:**
   ```bash
   rg -n "onMessageExternal|onConnectExternal|externally_connectable|window\.addEventListener\(['\"]message" --glob '*.{js,ts,json}'
   ```
2. **`onMessageExternal` / `onConnectExternal`:** confirm the handler checks
   `sender.id` / `sender.url` / `sender.origin` against an allowlist before
   doing anything privileged. Missing check = finding.
3. **`window.postMessage` handlers:** confirm `event.origin` (and often
   `event.source`) is validated. A handler that processes any-origin messages
   and reaches a sensitive sink (storage, network, navigation, code-exec) is
   a finding.
4. **`externally_connectable` scope** in the manifest: `<all_urls>` / `*://*/*`
   means any site can connect — justify against function.
5. **Trace the message into a sink.** The severity is set by what an
   unvalidated message can reach (read storage, trigger a request, mutate
   state, execute code).

## Heuristic

*an external/`postMessage` handler acts on message content AND does not
validate sender id / origin AND reaches a sensitive sink → "insecure
messaging / confused deputy."*

## Notes

`onMessageExternal` and `postMessage` survive minification as literal API
names — grep them, then read the handler body for the (missing) origin check.
