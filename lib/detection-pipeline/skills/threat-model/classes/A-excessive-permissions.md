# Class A — Excessive / over-broad permissions

**Category:** `permissions`
**Canonical example:** extensions shipping `<all_urls>` + `webRequest` (or
`cookies`, `debugger`, `nativeMessaging`) far beyond the stated feature set —
the standing precondition behind most browser-extension data breaches.
**Provenance:** illustrative pattern from general extension-security knowledge —
not a single cited incident, and not part of this skill's original first-party
basis (which was the compiled-JS scenario you specified + general knowledge).
**Protects:** the blast radius — what the extension *could* do if its code (or
a future update / new owner) turns hostile.

## Rule

An extension should request only the capabilities its stated functionality
needs. Over-broad permissions are a finding in their own right: they are the
latent capability a supply-chain push, ownership transfer, or injected
backdoor weaponizes without needing a new store review prompt.

## Canonical example

An extension requesting `<all_urls>` + `webRequest` (or `cookies`, `debugger`,
`nativeMessaging`) far beyond its stated feature — the standing precondition a
later malicious update or ownership change weaponizes without a new prompt.

## Detect

1. **Enumerate the grants in `manifest.json`** (`permissions`,
   `optional_permissions`, `host_permissions`, MV2 `permissions` host
   patterns).
   ```bash
   rg -n "permissions|host_permissions|<all_urls>|\*://\*/\*" manifest.json
   ```
2. **Match each grant to actual use in the code.** For every high-risk
   permission, confirm a corresponding `chrome.*` call exists and is on a
   real feature path. A permission requested but never used = over-broad.
3. **Flag the high-risk set** when not justified by stated purpose:
   `<all_urls>` / broad `host_permissions`, `cookies`, `webRequest[Blocking]`,
   `debugger`, `proxy`, `nativeMessaging`, `declarativeNetRequest`,
   `scripting`, `tabs`, `history`, `bookmarks`, `clipboardRead`, `management`.
4. **Content-script scope.** `content_scripts.matches` of `<all_urls>` /
   `*://*/*` injects into every site — justify against function (a
   single-site tool injecting everywhere is a finding).

## Heuristic

*a high-risk permission or `<all_urls>` host scope is granted AND no code path
uses it for the stated feature (or the scope vastly exceeds the feature) →
"over-broad permission / latent capability."*

## Notes

This class rarely produces an exploit by itself; rank it by the *capability*
it confers and cross-reference Classes B/C/G — over-broad scope is what turns
a future malicious update into a full compromise. Permissions live in the
plaintext manifest, so this is high-confidence regardless of bundle fidelity.
