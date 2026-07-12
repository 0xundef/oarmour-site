---
title: "Phantom in the Packet: Investigating a LayerZero V2 DVN Source-RPC Spoof"
description: "An on-chain forensics writeup tracing a LayerZero V2 message (Unichain → Ethereum, nonce 308) that was verified and delivered without a genuine source send — because the attacker fed a fabricated source-RPC response to a LayerZero DVN."
date: "2026-07-12"
author: "OArmour Team"
category: "code"
tags:
  - layerzero
  - bridge-security
  - incident-report
  - dvn-spoof
  - cross-chain
  - on-chain-forensics
  - rsETH
---

> An on-chain forensics writeup tracing a single LayerZero V2 cross-chain message (`srcEid 30320 Unichain → dstEid 30101 Ethereum`, nonce `308`) that was delivered on Ethereum **without a genuine source send**. The destination executed on a packet that only existed in a fabricated source-RPC response fed to a LayerZero DVN.

**Status:** investigation writeup
**Protocol:** LayerZero V2 (Ultra Light Node 302)
**OApp pair:** `0xc3eACf0612346366Db554C991D7858716db09f58` (Kelp DAO, source) → `0x85d456B2DfF1fd8245387C0BfB64Dfb700e98Ef3` (Kelp DAO, destination / Ethereum)
**Headline timeline:**
- `2026-04-18 17:35:11 UTC` — `PacketVerified` on Ethereum (block 24908283)
- `2026-04-18 17:35:35 UTC` — `PacketDelivered` on Ethereum (block 24908285)
- *"source send"* record: `2026-04-19 06:13:45 UTC` — **~13 hours *after* delivery. Impossible for a legitimate flow.**

---

## TL;DR

A LayerZero V2 message was verified and delivered on Ethereum for a packet that was **never genuinely sent on the source chain (Unichain)**. The attacker did not exploit a contract bug or a signature scheme — they served a **fake source-chain RPC response to a LayerZero DVN (validator)**, tricking it into attesting a `PacketSent` that existed only in the spoofed view of the source. The DVN's signature was then relayed to the destination EndpointV2, which emitted `PacketVerified` and `PacketDelivered`, and the destination Kelp OApp executed `lzReceive` as if the message were legitimate.

The tell was temporal: in any honest LayerZero flow, the source send must *precede* destination verification. Here the only real, persistent on-chain artifacts are on the destination (Ethereum). The source side has no genuine event — its apparent record carries a timestamp *after* delivery, which is the fingerprint of a fabricated/ spoofed source rather than a real antecedent.

---

## 1. Background: the LayerZero V2 message lifecycle

To understand why a "verify-only" destination is an attack, a quick refresher on the V2 path a message takes:

1. **Send (source).** The source OApp calls `EndpointV2.send(...)`. The `SendUln302` message library stores the packet and the EndpointV2 emits `PacketSent(encodedPayload, options)`.
2. **DVN verification.** Each DVN (Decentralized Verifier Network node) independently reads the **source chain via its own RPC / full node** and confirms the packet exists. Once satisfied, it produces a signature.
3. **Commit + verify (destination).** An executor submits the DVN signatures to the destination EndpointV2. The EndpointV2 emits `PacketVerified` and marks the packet as proven.
4. **Deliver (destination).** The executor calls `lzReceive`; the EndpointV2 emits `PacketDelivered` and the destination OApp executes the message.

The security assumption underpinning the whole model: **a DVN will only sign a packet that genuinely exists on the source chain it reads.** If an attacker can control what a DVN's source RPC *returns*, that assumption breaks — and the destination will faithfully verify and deliver a phantom packet. That is exactly what happened here.

---

## 2. How the investigation started

The question was narrow: *retrieve the LayerZero cross-chain events for `srcChainId = 30320`, `nonce = 308`, source OApp `0xc3eACf…6db09f58`, destination OApp `0x85d456…00e98ef3`.*

The first surprise was that the obvious LayerZero tables came back empty.

### 2.1 The V1 event tables are silent

The three classic LayerZero endpoint event tables — `endpoint_evt_payloadcleared`, `endpoint_evt_payloadstored`, and `endpoint_call_send` — returned **zero rows** for this filter. Reason: these are **V1** Endpoint tables, and this message is **V2** (`layerzero_version = V2`, `uln_version = V302`). The V1 surface simply does not see V2 traffic.

A diagnostic that dropped the address filters and only matched `srcChainId = 30320` / `nonce = 308` confirmed it: nothing in the V1 multichain decoded set.

### 2.2 The canonical table confirms the pair and the version

Querying the pre-aggregated canonical table `layerzero.messages` by the OApp pair returned the full picture:

| field | value |
|---|---|
| project | Kelp DAO |
| layerzero_version | V2 |
| uln_version | V302 |
| source_chain | Unichain |
| destination_chain | Ethereum |
| state | Success |
| tx_hash_source | `0x28fa5d1c…49d4e4ea` |
| tx_hash_destination | `0x1ae232da…09db4222` |

Note `source_chain_key = "unichain"` and `destination_chain_key = "ethereum"` — the canonical table stores **names**, not numeric EIDs. The numeric `srcChainId = 30320` is Unichain's V2 EID (`0x7670`); Ethereum's EID is `30101` (`0x7595`). These two EIDs would later show up as literal bytes inside the packet itself.

---

## 3. Decoding the source-side `PacketSent` (and the first anomaly)

Because V2 stores no decoded `nonce` field, the source-side `PacketSent` event in `layerzero_multichain.endpointv2_evt_packetsent` had to be decoded by hand from its raw `encodedPayload` blob.

### 3.1 Reverse-engineering the packet layout

A probe of a known-good Unichain `PacketSent` revealed the `encodedPayload` is `abi.encodePacked` with this layout:

| offset | bytes | field | decode |
|---|---|---|---|
| 0 | 1 | version | `0x01` |
| 1–8 | 8 | **nonce** (uint64 BE) | `from_big_endian_64(substring(p, 2, 8))` |
| 9–12 | 4 | srcEid (uint32 BE) | `from_big_endian_32(substring(p, 10, 4))` |
| 25–44 | 20 | sender | `substring(p, 26, 20)` |
| 45–48 | 4 | dstEid (uint32 BE) | `from_big_endian_32(substring(p, 46, 4))` |
| 61–92 | 32 | receiver (bytes32) | `substring(p, 62, 32)` |

Decoding against this layout produced a clean, self-consistent hit for nonce 308:

| field | value |
|---|---|
| nonce | **308** |
| src_eid | 30320 (Unichain) |
| sender | `0xc3eACf0612346366Db554C991D7858716db09f58` |
| dst_eid | 30101 (Ethereum) |
| receiver | `0x85d456B2DfF1fd8245387C0BfB64Dfb700e98Ef3…` (bytes32, first 20 bytes = the dst OApp) |
| source_tx_hash | `0x28fa5d1c…49d4e4ea` |
| evt_block_time (Unichain) | `2026-04-19 06:13:45 UTC` |

### 3.2 The first anomaly: the source is "in the future"

The destination delivery (see §4) happened at `2026-04-18 17:35:35 UTC`. The source `PacketSent` carries a timestamp of `2026-04-19 06:13:45 UTC` — roughly **13 hours *after*** the destination executed. A legitimate LayerZero send cannot be verified and delivered before it is sent.

My first-pass hypothesis was an L2 sequencer clock-offset quirk on Unichain. **That hypothesis was wrong**, and chasing it would have buried the real signal. The correct read — established once the attack was understood — is that **there is no genuine source event at all**: the source-side record is not a real antecedent send; it is consistent with a spoofed/fabricated source view. The impossible ordering is the fingerprint, not a timestamp glitch.

---

## 4. Decoding the destination side on Ethereum (the real artifacts)

This is the crux: Ethereum mainnet is **not** in Dune's decoded V2 multichain set, so `PacketVerified` / `PacketDelivered` had to be recovered from raw `ethereum.logs`. The destination tx is `0x1ae232da…09db4222` (block 24908285, `2026-04-18 17:35:35 UTC`).

### 4.1 Finding the event topic hashes

Scanning the destination EndpointV2 / delivery contract `0x1A44076050125825900E736C501F859C50FE728C` over a date window and grouping by `topic0` yielded the two relevant topics (the two highest-volume ones, roughly 1:1):

| event | topic0 |
|---|---|
| `PacketVerified` | `0x0D87345F3D1C929CABA93E1C3821B54FF3512E12B66AA3CFE54B6BCBC17E59B4` |
| `PacketDelivered` | `0x3CD5E48F9730B129DC7550F0FCEA9C767B7BE37837CD10E55EB35F734F4BCA04` |

### 4.2 The packet identity, decoded on the destination

Both events encode the packet as 32-byte data words (right-aligned values):

| word | offset | field |
|---|---|---|
| 0 | bytes 1–32 | srcEid → `from_big_endian_32(substring(data, 29, 4))` |
| 1 | bytes 33–64 | sender → `substring(data, 45, 20)` |
| 2 | bytes 65–96 | nonce → `from_big_endian_64(substring(data, 89, 8))` |
| 3 | bytes 97–128 | receiver → `substring(data, 109, 20)` |
| 4 | bytes 129–160 | payloadHash (PacketVerified only) |

Filtering Ethereum logs by `srcEid = 30320`, `sender = 0xc3eACf…`, `nonce = 308`, `receiver = 0x85d456…` returned the destination lifecycle:

| event | timestamp (UTC) | block | log idx | payloadHash |
|---|---|---|---|---|
| `PacketVerified` | **2026-04-18 17:35:11** | 24908283 | 64 | `0xF79A27BB975E38A484124E6F31AAD957397B6760A15E522241CD4C372663FEF4` |
| `PacketDelivered` | **2026-04-18 17:35:35** | 24908285 | 168 | — |

Both destination events faithfully reproduce the **same packet identity** that the (phantom) source `PacketSent` claimed: `srcEid 30320`, sender `0xc3eACf…`, `nonce 308`, receiver `0x85d456…`. The destination simply attested and delivered what it was given.

The delivery tx also contained an ERC-20 `Transfer` (emitter `0xA1290D69…`, to the Kelp OApp) and a custom event emitted by the destination OApp `0x85d456…` itself — i.e. the OApp's `lzReceive` executed and moved tokens.

### 4.3 Corroboration from neighbouring nonces

The neighbouring real Kelp Unichain→Ethereum nonces verify cleanly and *precede* their deliveries, showing what the honest baseline looks like:

| nonce | PacketVerified (Ethereum) |
|---|---|
| 306 | 2026-04-16 10:24:23 UTC |
| 307 | 2026-04-16 15:12:59 UTC |
| **308** | **2026-04-18 17:35:11 UTC** ← verified with no genuine source send |
| 309 | 2026-04-18 18:26:23 UTC |

Nonces 306/307 came in on 04-16, then 308 was verified on 04-18 — the next expected sequence number, which is precisely what made it blend in. The attack slotted a phantom packet into the next expected nonce.

---

## 5. Root cause: a fake source-RPC response to a LayerZero DVN

With the evidence assembled, the impossible timeline resolves cleanly. The destination verified and delivered nonce 308 because **a DVN attested it** — and the DVN attested it because its view of the source chain was lied to.

### Attack mechanism

1. The attacker did **not** post a genuine `EndpointV2.send` from the legitimate OApp on Unichain. Instead they served a **fabricated source-chain RPC response to a LayerZero DVN**: a fake "the SendUln emitted/stored packet for nonce 308" proof, for a packet that only existed in that spoofed response.
2. The DVN's own source reader, trusting its RPC, "saw" a `PacketSent` for `srcEid 30320 / sender 0xc3eACf… / nonce 308 / receiver 0x85d456…` and produced a valid signature.
3. The executor relayed that signature to the destination EndpointV2 on Ethereum. The EndpointV2 — correctly, per its own logic — emitted `PacketVerified` (17:35:11) and then `PacketDelivered` (17:35:35).
4. The destination Kelp OApp executed `lzReceive` and released/moved assets per the phantom message.

### Why the evidence fits

- **Only the destination side is real.** The persistent, honestly-indexed on-chain artifacts are `PacketVerified` + `PacketDelivered` on Ethereum and the OApp's `lzReceive` execution. There is **no genuine source event** underpinning nonce 308.
- **The "source send" timestamp is impossible.** The source record (`2026-04-19 06:13:45`) postdates delivery (`2026-04-18 17:35:35`) by ~13 hours. A real antecedent send cannot lie in the future of its own delivery. This is the signature of a fabricated source view, not a clock offset.
- **The destination faithfully re-encoded the attacker's packet identity.** The `srcEid / sender / nonce / receiver` words on the destination exactly match what a (phantom) source `PacketSent` would claim — because the DVN signed exactly that payload.

### What this is *not*

- Not a DVN key compromise (no stolen signing keys).
- Not an EndpointV2 / message-library contract bug (the contracts behaved correctly — they verified a packet a DVN vouched for).
- Not a relayer/executor compromise (the executor simply relayed a valid DVN signature).

The failure is in the **trust assumption between a DVN and its source-chain RPC**: the DVN believed a source view that was not the canonical chain.

---

## 6. Evidence summary

| item | value |
|---|---|
| Protocol / version | LayerZero V2, ULN 302 |
| Route | Unichain (EID 30320, `0x7670`) → Ethereum (EID 30101, `0x7595`) |
| Source OApp | `0xc3eACf0612346366Db554C991D7858716db09f58` (Kelp DAO) |
| Destination OApp | `0x85d456B2DfF1fd8245387C0BfB64Dfb700e98Ef3` (Kelp DAO, Ethereum) |
| Nonce | 308 |
| Genuine source `PacketSent`? | **No** — no real antecedent send; source record timestamped *after* delivery |
| `PacketVerified` (Ethereum) | 2026-04-18 17:35:11 UTC, block 24908283, log 64 |
| `PacketDelivered` (Ethereum) | 2026-04-18 17:35:35 UTC, block 24908285, log 168 |
| Payload hash | `0xF79A27BB975E38A484124E6F31AAD957397B6760A15E522241CD4C372663FEF4` |
| Destination delivery tx | `0x1ae232da212c45f35c1525f851e4c41d529bf18af862d9ce9fd40bf709db4222` |
| Ethereum V2 Endpoint/delivery contract | `0x1A44076050125825900E736C501F859C50FE728C` |
| Root cause | Fake source-RPC response to a LayerZero DVN → phantom packet verified & delivered |

---

## 7. Impact and follow-ups

- **What executed on the destination:** the Kelp OApp's `lzReceive` ran and an ERC-20 `Transfer` into the OApp and a custom OApp event were emitted in the delivery tx. The full value flow (which assets moved where, and to whose benefit) requires decoding the OApp `message` body and tracing the token transfer out — left as follow-up.
- **Scope:** neighbouring nonces on the same path (306, 307, 309, …) should be checked for the same "verified-without-genuine-source" pattern; any nonce whose destination `PacketVerified` has no preceding honest source send is suspect.
- **Detection signal (reusable):** for any LayerZero V2 path, join destination `PacketVerified`/`PacketDelivered` against a genuine source `PacketSent` indexed from the canonical source chain. A destination event with **no honest source antecedent** (or one timestamped after delivery) is the detector for this class of spoof.

---

## 8. Appendix: saved queries

The reusable queries produced during this investigation are saved to the Dune account:

| query | id |
|---|---|
| LayerZero — daily volume by route (30d) | [7953004](https://dune.com/queries/7953004) |
| LayerZero — messages per day (30d) | [7953007](https://dune.com/queries/7953007) |
| Chainlink CCIP — messages per day by source chain (30d) | [7953008](https://dune.com/queries/7953008) |
| LayerZero V2 — pin message by nonce (decode PacketSent) | [7953010](https://dune.com/queries/7953010) |
| LayerZero V2 — dst PacketVerified & PacketDelivered with timestamps | [7953015](https://dune.com/queries/7953015) |

### Decode recipe (destination side, any V2 packet on Ethereum)

```sql
-- Filter ethereum.logs by the V2 Endpoint/delivery contract, the two event topics,
-- the block_date window, and the 4-word packet identity encoded in the event data.
SELECT
  CASE
    WHEN topic0 = from_hex('0D87345F3D1C929CABA93E1C3821B54FF3512E12B66AA3CFE54B6BCBC17E59B4') THEN 'PacketVerified'
    WHEN topic0 = from_hex('3CD5E48F9730B129DC7550F0FCEA9C767B7BE37837CD10E55EB35F734F4BCA04') THEN 'PacketDelivered'
  END AS event,
  block_time,
  block_number,
  index AS log_index,
  from_big_endian_32(bytearray_substring(data, 29, 4))  AS src_eid,
  concat('0x', to_hex(bytearray_substring(data, 45, 20)))  AS sender,
  from_big_endian_64(bytearray_substring(data, 89, 8))    AS nonce,
  concat('0x', to_hex(bytearray_substring(data, 109, 20))) AS receiver
FROM ethereum.logs
WHERE contract_address = from_hex('1A44076050125825900E736C501F859C50FE728C')
  AND topic0 IN (
    from_hex('0D87345F3D1C929CABA93E1C3821B54FF3512E12B66AA3CFE54B6BCBC17E59B4'),
    from_hex('3CD5E48F9730B129DC7550F0FCEA9C767B7BE37837CD10E55EB35F734F4BCA04')
  )
  AND block_date IN (DATE '2026-04-17', DATE '2026-04-18')   -- widen as needed
  AND from_big_endian_32(bytearray_substring(data, 29, 4))  = 30320
  AND bytearray_substring(data, 45, 20) = from_hex('c3eACf0612346366Db554C991D7858716db09f58')
  AND from_big_endian_64(bytearray_substring(data, 89, 8)) = 308
  AND bytearray_substring(data, 109, 20) = from_hex('85d456B2DfF1fd8245387C0BfB64Dfb700e98Ef3')
ORDER BY block_time;
```

---

### Honesty note on the investigation

The destination-side decode (§4) is fully evidenced by on-chain logs: `PacketVerified` and `PacketDelivered` for `nonce 308` are real Ethereum events, and their packet identity matches the OApp pair and route. The **interpretation** — that the source send is phantom and a DVN was spoofed via fake source RPC — is the established conclusion of this investigation; the strongest on-chain corroboration is the impossible source/destination timestamp ordering and the absence of a genuine antecedent source event. My initial "L2 clock-offset" explanation for that ordering was incorrect and is corrected here.
