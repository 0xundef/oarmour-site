# Class B — Data exfiltration

**Category:** `dataflow`
**Canonical example:** DataSpii (2019) — extensions siphoning full browsing
history / URLs (often containing tokens & PII) to third-party "analytics"
endpoints.
**Provenance:** public, widely-reported incident (Sam Jadali / "DataSpii").
Added in this session for illustration; verify against the primary writeup
before external citation. Not part of this skill's original first-party basis.
**Protects:** user data that should never leave the device.

## Rule

A sensitive source (cookies, history, DOM contents, form fields, clipboard,
page URLs) must not flow to an off-device network sink without an explicit,
disclosed purpose. Routing it through an "analytics"/telemetry SDK does not
make it acceptable — the SDK is a network sink.

## Canonical example

DataSpii (2019): browser extensions collected full browsing history and URLs
(often carrying tokens / PII) and shipped them to third-party "analytics"
endpoints, exposing millions of users' private data.

## Detect

1. **Identify sensitive sources:**
   ```bash
   rg -n "chrome\.cookies|chrome\.history|chrome\.bookmarks|document\.cookie|navigator\.clipboard|\.value|localStorage" --glob '*.{js,ts}'
   ```
2. **Identify network sinks** — not just raw HTTP, also telemetry SDKs:
   ```bash
   rg -n "fetch\(|XMLHttpRequest|sendBeacon|WebSocket|posthog|capture\(|Segment|amplitude|mixpanel|gtag" --glob '*.{js,ts}'
   ```
3. **Trace source → sink, every hop.** Flag any sensitive value reaching a
   network/telemetry sink. Watch for **semantic mismatch** (sensitive data
   placed in a field named `error`/`event`/`meta`).
4. **Extract the destination host literal** for each sink. A first-party API
   is expected; a third-party / lookalike / newly-added domain is the finding.
   Compare against the vendor's real domains.
5. **Volume & breadth.** Sending *all* URLs / full DOM / all cookies (vs. a
   single scoped field) escalates severity.

## Heuristic

*a sensitive source is data-flow-reachable from a network or telemetry sink,
AND the destination is third-party / undisclosed / lookalike → "data
exfiltration."*

## Notes

The destination host literal survives minification — it's your strongest
anchor. If only beautified, assert the *flow* but flag exact reachability as
"needs manual confirmation" per the confidence discipline.
