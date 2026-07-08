# Class F — Privacy / tracking

**Category:** `privacy`
**Canonical example:** "free utility" extensions that quietly read
history/bookmarks/geolocation or fingerprint the user and ship it to an
ad/analytics network beyond any stated purpose.
**Provenance:** illustrative pattern from general extension-security knowledge —
not a single cited incident, and not part of this skill's original first-party
basis.
**Protects:** user privacy — data that is sensitive even when it isn't a
secret or credential.

## Rule

Reading user-profiling data (history, bookmarks, geolocation, installed-page
inventory, fingerprinting signals) and sending it off-device — or to a
third-party tracker — without clear, necessary purpose is a privacy finding,
even absent a classic "exploit."

## Canonical example

A "free utility" extension that quietly reads history / bookmarks / geolocation
or fingerprints the device and ships it to an ad/analytics network beyond any
stated purpose.

## Detect

1. **Profiling sources:**
   ```bash
   rg -n "chrome\.history|chrome\.bookmarks|chrome\.topSites|geolocation|chrome\.tabs\.query|navigator\.userAgent|canvas|webgl" --glob '*.{js,ts}'
   ```
2. **Tracking sinks.** Same network/telemetry sinks as Class B, plus known
   ad/analytics hosts. Trace the profiling data to the sink.
3. **Necessity test.** Does the stated feature need this data? A wallpaper or
   note-taking extension reading full history fails the test.
4. **Fingerprinting.** Canvas/WebGL/font enumeration assembling a device id is
   a privacy finding when transmitted.
5. **Disclosure.** Cross-check against any stated privacy policy / purpose;
   undisclosed collection escalates it.

## Heuristic

*a profiling/fingerprinting source flows to an off-device or third-party sink
AND is not required by the stated feature → "undisclosed privacy collection /
tracking."*

## Notes

Overlaps Class B (exfiltration) — use B when the data is a secret/credential,
F when it's profiling/tracking data. Both hinge on the destination host
literal, which survives minification.
