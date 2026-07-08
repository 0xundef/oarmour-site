# Class E — Content-script DOM injection

**Category:** `dataflow`
**Canonical example:** content scripts that build page UI by writing
attacker-influenced data into `innerHTML` / `insertAdjacentHTML`, yielding DOM
XSS in the content-script (and sometimes the extension) context.
**Provenance:** illustrative pattern from general extension-security knowledge —
not a single cited incident, and not part of this skill's original first-party
basis.
**Protects:** the integrity of the page DOM the extension manipulates, and the
content-script context itself.

## Rule

Untrusted data (page content, URL params, message payloads, network responses)
must never reach an HTML-parsing DOM sink without sanitization. In a content
script this is DOM XSS; combined with extension APIs it can escalate.

## Canonical example

A content script that builds page UI from attacker-influenced data via
`innerHTML` / `insertAdjacentHTML`, producing DOM XSS in the content-script
(and sometimes the privileged extension) context.

## Detect

1. **HTML-parsing sinks:**
   ```bash
   rg -n "innerHTML|outerHTML|insertAdjacentHTML|document\.write|\.html\(|dangerouslySetInnerHTML|Range\.createContextualFragment" --glob '*.{js,ts,jsx,tsx}'
   ```
2. **Back-trace each sink's argument.** Trusted = static strings / sanitized
   (`textContent`, DOMPurify). Untrusted = page DOM, `location.*`,
   `URLSearchParams`, message payloads, fetched content. Untrusted → HTML sink
   without sanitization = finding.
3. **Injection scripts.** `scripting.executeScript` / injected `<script>`
   built from untrusted data = finding.
4. **Sanitizer presence is the positive control** — its absence on an
   untrusted→HTML flow is the finding.

## Heuristic

*untrusted data is data-flow-reachable from an HTML-parsing sink
(`innerHTML`/`document.write`/…) with no sanitization → "content-script DOM
injection / DOM XSS."*

## Notes

Sink names survive minification; the source side may be obfuscated — resolve
it from the normalized bundle. If only beautified, flag the high-impact case
as "needs manual confirmation."
