# Threat model corpus — wallet layer (vendored)

Vendored snapshot of the `wallet-ext-audit` skill from
[`0xundef/defending-agent`](https://github.com/0xundef/defending-agent)
(`.pi/skills/wallet-ext-audit/`).

- `SKILL.md` — router + wallet-specific methodology (trust boundaries incl.
  the encrypted vault, wallet grep anchors, cross-cutting checklist).
- `classes/*.md` — the 12 wallet bug classes (A–L): secret exposure,
  web-accessible clickjacking, chain-identity trust, telemetry seed exfil,
  clipboard/address swap, transaction tampering, signature phishing,
  impersonation + remote payload, remote code/config, insecure dApp
  messaging / provider, session/cookie theft, dependency supply-chain.

This corpus is **layered ON TOP of** the generic `chrome-ext-audit` corpus
(see `../threat-model/`). `loadThreatModel()` reads every `.md` here
(recursively, frontmatter stripped) and appends it to the generic corpus, so
wallet/web3 targets (MetaMask, Trust Wallet, Phantom, …) get the
wallet-specific detection rules. For non-wallet extensions this is inert
overhead — the find agents simply don't match the wallet anchors.

The wallet classes map to these `signalClass` values (see
`lib/detection-pipeline/schemas.ts`): `secret-exposure`, `clickjacking`,
`signing-trust`, `signature-phishing`, `clipboard-swap`, `tx-tampering`,
`impersonation`, `session-theft` (and `remote-code` / `messaging` /
`supply-chain` shared with the generic model).

**Drift:** this is a snapshot. To track upstream, re-download from the source
repo, or point `DETECTION_WALLET_THREAT_MODEL_DIR` at a checked-out copy.
Set that env to a non-existent path (or `default` with no repo dir) to
disable the wallet layer.
