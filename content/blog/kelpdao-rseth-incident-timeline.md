---
title: "KelpDAO rsETH Bridge — Full Incident Timeline (Off-Chain + On-Chain)"
date: "2026-07-10"
description: "A phase-by-phase reconstruction of the KelpDAO rsETH bridge incident: DPRK social engineering, RPC poisoning, the forged nonce-308 attestation, the Aave cascade, the Arbitrum Security Council forced transfer, and the laundering dispersal."
author: "OArmour Team"
category: "code"
tags:
  - bridge-security
  - incident-report
  - dprk
  - layerzero
  - rsETH
  - aave
  - arbitrum
---

> **Interactive timeline →** [Open the full off-chain + on-chain incident timeline](/reports/kelpdao-incident-timeline.html) — an interactive, themeable SVG with per-event tooltips, address links to Etherscan/Arbiscan, and an all-events table view.

---

## Executive summary

On **2026-04-18 17:35 UTC**, a forged DVN attestation was accepted on the KelpDAO rsETH LayerZero bridge, releasing **116,500 rsETH** with no matching source-side burn. The source endpoint's maximum outbound nonce remained **307**, while the destination accepted **nonce 308** — the on-chain fingerprint of the forge.

Attribution: **DPRK UNC4899 / TraderTraitor**. Signer keys were *not* compromised; the attack was achieved by poisoning the LayerZero Labs DVN's RPC layer so it signed a false attestation against state it never truly observed.

The 116,500 rsETH was dispersed across **seven wallets**, of which **89,567 rsETH (~$227.6M)** was deposited into Aave V3 E-Mode markets and leveraged into **~$200M of WETH/wstETH borrows** at health factors of **1.01–1.03**. The response touched KelpDAO, Aave (five chains, &gt;$6.7B of WETH frozen), and culminated in the **Arbitrum Security Council** force-transferring **30,765.67 ETH** to a frozen address without any holder signature.

As of **2026-04-22 05:42 UTC**: **30,766 ETH frozen**, **3,576 rsETH intercepted**, **25,702 ETH idle**, **~50,000 ETH dispersing**.

**Sources:** [LayerZero Labs — KelpDAO Incident Report](https://layerzero.network/publications/kelpdao-incident-report.pdf) · [BlockSec — The Decentralization Dilemma](https://blocksec.com/blog/the-decentralization-dilemma-cascading-risk-and-emergency-power-in-the-kelp-dao-crisis). All times UTC.

---

## Phase 1 — Pre-incident: Aave parameters (≈ Jan – Apr 9)

The safety buffer was compressed before the attacker ever touched the chain.

| Date | Event |
| --- | --- |
| ≈ Jan 2026 | Aave raised rsETH E-Mode LTV **92.5% → 93%** (buffer 2.5% → 2%; liquidation threshold 95%). Off-chain governance. |
| Mar 30 | Aave V4 launched on Ethereum. |
| Apr 9 | Aave Risk Steward raised rsETH supply caps: Ethereum Core **480,000 → 530,000**; Mantle **52,000 → 70,000**. On-chain. |

The narrowed 2% buffer meant a relatively small rsETH price move could tip collateral positions into liquidation — the precondition for the DeFi cascade in Phase 4.

---

## Phase 2 — Intrusion & dwell: DPRK (off-chain, Mar 6 – Apr 18)

- **Mar 6, 12:59:03–13:06:28** — Developer1 was socially engineered into cloning a malicious GitHub repo. **FLATROOF** + **ROOFDECK** macOS backdoors were dropped and session keys harvested. EDR did not detect.
- **Mar 30 → Apr 16** — Using Developer1's session keys, the actor accessed LayerZero's GCP and GitHub over commercial VPNs (ExpressVPN / NordVPN / Mullvad), conducting reconnaissance and establishing persistence.
- **Apr 16 → Apr 18** — Lateral movement across two GKE clusters in two regions. An ELF PIE was injected into **op-geth**: it returned correct responses to monitoring but **tampered RPC responses to the LayerZero Labs DVN**.

---

## Phase 3 — Exploit execution (Apr 18)

- **16:30** — A DoS against external RPC providers forced LayerZero's failover logic onto the two poisoned internal nodes only.
- **17:35** — The DVN, reading only poisoned nodes, signed a forged attestation. The Ethereum destination endpoint accepted **nonce 308**, releasing **116,500 rsETH** with no source-side burn. The Unichain source endpoint still reports max outbound nonce **307** — the on-chain proof of the forge. The 1-of-1 single-verifier OApp config accepted the single attestation.

> Adapter [`0x85d4…8ef3`](https://etherscan.io/address/0x85d456b2dff1fd8245387c0bfb64dfb700e98ef3) · tx [`0x1ae2…4222`](https://etherscan.io/tx/0x1ae232da212c45f35c1525f851e4c41d529bf18af862d9ce9fd40bf709db4222)

---

## Phase 4 — Cascade into DeFi (Apr 18)

- The 116,500 rsETH was dispersed across **seven branch wallets**. **89,567.22 rsETH (~$227.6M)** was deposited into Aave V3 lending markets on Ethereum Core and Arbitrum using E-Mode for maximum LTV. Largest Ethereum-Core borrower: [`0x1f4c…adef`](https://etherscan.io/address/0x1f4c1c2e610f089d6914c4448e6f21cb0db3adef) (52,440.58 WETH).
- Borrowed **~$200M** via E-Mode: **52,834.50 WETH (~$127M)** on Ethereum Core and **29,785.98 WETH + 821.24 wstETH** on Arbitrum. Health factors **1.01–1.03** across seven addresses. Proceeds consolidated to [`0x5d39…7ccc`](https://etherscan.io/address/0x5d3919f12bcc35c26eee5f8226a9bee90c257ccc) on Ethereum + Arbitrum.

This is the operational point of the whole intrusion: rsETH was a vehicle to borrow liquid WETH against razor-thin health factors — a leveraged position designed to externalize the bad debt onto Aave if it went underwater.

---

## Phase 5 — Response: pauses & freezes

| Date | Event |
| --- | --- |
| Apr 18 (≤ 46 min) | KelpDAO detected the anomaly and paused all relevant contracts within 46 minutes, **blocking a subsequent attempt targeting an additional 40,000 rsETH (~$95M)**. |
| Apr 18, 18:30:31 | A cross-chain transfer of **3,575.57 rsETH** via LZMultiCall **failed — bridge-intercepted**. Funds stuck at [`0x8e60…286e`](https://arbiscan.io/address/0x8e60b7b64b63cd56b18ebcecadcb79b04919286e) on Arbitrum. |
| Apr 19 | Aave Protocol Guardian froze all **rsETH and wrsETH** markets across V3 and V4 — no new deposits or borrows against rsETH collateral. |
| Apr 20 | Aave froze **WETH across 5 chains** (Ethereum, Arbitrum, Base, Mantle, Linea) — combined reserves &gt; **$6.7B**. Base, Mantle, and Linea were frozen *preventively* (the attacker never touched them) due to latent bad-debt risk from rsETH collateral. |

---

## Phase 6 — Emergency recovery (Apr 21)

The defining moment of the response: the **Arbitrum Security Council** force-transferred **30,765.67 ETH** from the exploiter address to frozen address [`0x…0da0`](https://arbiscan.io/address/0x0000000000000000000000000000000000000da0) — **without any holder signature**.

It was executed as an atomic three-step on the upgradeable Arbitrum DelayedInbox:

1. An upgrade Executor temporarily upgraded the DelayedInbox, adding `sendUnsignedTransactionOverride`.
2. `Bridge.enqueueDelayedMessage` (kind=3) enabled an unsigned L2 transaction with `sender = exploiter` (via L1→L2 aliasing).
3. The inbox was restored.

- L1 tx [`0x0799…f770`](https://etherscan.io/tx/0x079984c56c5670108f5c6f664904178f9b364340351949a42e4637d1f645f770)
- L2 tx [`0x5618…0f6b`](https://arbiscan.io/tx/0x5618044241dade84af6c41b7d84496dc9823700f98b79751e257608dac570f6b)

WETH was then **unfrozen on Ethereum Core V3 only**, with LTV kept at **0** as a precaution. WETH on Ethereum Prime, Arbitrum, Base, Mantle, and Linea remained frozen.

This is the case study behind BlockSec's "decentralization dilemma": a Security Council's emergency power was used to move funds a holder never authorized — effective for recovery, but a sharp edge on the protocol's trust assumptions.

---

## Phase 7 — Laundering & status (Apr 21–22)

- **Apr 21, 08:05–20:21** — [`0xf980…0b85`](https://etherscan.io/address/0xf9802c5eb6b972ba686afa7ca615910ea8310b85) dispersed ~25,000 ETH across **103 first-hop addresses**, then swept the final 8.989 ETH into [`0x62c7…c64e`](https://etherscan.io/address/0x62c72510016732333e68177d388a8111643fc64e).
- **Apr 21, 11:16** — [`0xd4b8…1530`](https://etherscan.io/address/0xd4b87bab0ee142182f7f6da030aefe3e7f171530) received **25,701.76 ETH**; untouched since.
- **Apr 21, 20:13** — [`0x62c7…c64e`](https://etherscan.io/address/0x62c72510016732333e68177d388a8111643fc64e) began fanning out ETH to additional first-hop addresses; still active the next day.
- **Apr 22, 05:42** — Status snapshot.

### Fund-status snapshot (2026-04-22 05:42 UTC)

| State | Amount | Location |
| --- | --- | --- |
| Frozen | 30,765.67 ETH | `0x…0da0` on Arbitrum |
| Bridge-intercepted | 3,575.57 rsETH | LZMultiCall `0x8e60…286e` (Arbitrum) |
| Idle | 25,701.76 ETH | `0xd4b8…1530` |
| Dispersed / dispersing | ~50,000 ETH | `0xf980…` + `0x62c7…` across 103 first-hop addresses |

rsETH collateral on Aave remains deposited; the borrowed WETH/wstETH was **not repaid**. Consolidation address `0x5d39…7ccc` was used on Ethereum + Arbitrum.

---

## Read the interactive timeline

The written report above is a static summary. The full visualization is interactive — per-event tooltips, a light/auto/dark theme toggle, and every on-chain address linked to Etherscan or Arbiscan:

**→ [Open the KelpDAO rsETH incident timeline](/reports/kelpdao-incident-timeline.html)**
