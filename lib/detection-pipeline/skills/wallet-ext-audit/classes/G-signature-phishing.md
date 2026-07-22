# Class G — Blind signing / off-chain signature phishing

**Category:** `signature-phishing`
**Canonical example:** Permit / Permit2 off-chain approval drains; EIP-712
normalization bypass (ScamSniffer + SlowMist), `eth_signTypedData_v4` permit
farming (Blockaid breakdown).
**Provenance:** illustrative — well-documented Permit/Permit2/EIP-712 phishing
technique, not a single cited incident.
**Protects:** the user's understanding of what an off-chain signature authorizes.

## Rule

A wallet must render, in human terms, exactly what a signature authorizes
before the user signs — and must not present authorization-bearing signatures
(EIP-2612 `permit`, Permit2, `setApprovalForAll`) as opaque hex or unverifiable
typed data. The danger of off-chain signatures is that **no on-chain
transaction appears** — the only artifact is an allowance the victim "never
sent."

## Canonical example

- **Permit / Permit2 farming.** A drainer calls `eth_signTypedData_v4` with an
  EIP-2612 `permit` (nonce + token `name` + spender = attacker + huge amount).
  Because it's a signature, not a transaction, most wallets **don't simulate
  it**; the attacker later submits it on-chain via the token's `permit`
  function to gain transfer rights.
- **EIP-712 normalization bypass.** The drainer passes `verifyingContract` as a
  numeric address; normalization converts it to a form the wallet's security
  UI renders as unreadable, so the user can't tell which contract they're
  authorizing. Tested-vulnerable wallets included MetaMask, Rabby, Rainbow,
  OKX Web3, TokenPocket at disclosure time.
- **`eth_sign` blind sign.** Raw `eth_sign` over an arbitrary 32-byte hash is
  signable into a valid transaction/authorization the user never saw rendered.

## Detect

1. **Signing surfaces:**
   ```bash
   rg -n "eth_sign\b|personal_sign|signTypedData|eth_signTypedData_v4|permit|Permit2|setApprovalForAll" --glob '*.{js,ts}'
   ```
2. **Rendering quality of typed data.** For each `signTypedData` path, confirm
   the wallet **parses and renders** the EIP-712 schema (token symbol, spender
   label, human-unit amount, expiry) rather than showing the raw hash or a hex
   blob. Falling back to hex on unknown types = phishing surface (finding).
3. **`verifyingContract` / domain handling.** Check the domain separator's
   `verifyingContract` and `chainId` are rendered as readable, attributed
   values and not silently normalized into an unreadable form. No normalization
   guard = finding (cross-ref Class C for chainId trust).
4. **Raw `eth_sign` policy.** Flag enabling raw `eth_sign` without a hard
   warning / disabled-by-default posture.
5. **Simulation / allowance preview.** Absence of any off-chain-signature
   simulation or allowance preview for `permit`/`Permit2`/approval-bearing
   signatures is itself the finding — the user has no way to see the grant.
6. **Approval amount surfacing.** Confirm `permit`/`approve` amounts (esp.
   `unlimited` / `2^256-1`) are surfaced explicitly, not buried.

## Heuristic

*an authorization-bearing signature (`permit`/Permit2/`setApprovalForAll`/raw
`eth_sign`) can be signed AND the wallet renders it as hex / unparsed typed
data / un-normalized `verifyingContract`, OR no simulation/allowance preview
exists → "blind-signing / signature-phishing surface."*

## Notes

Unlike on-chain approval phishing, off-chain permit phishing leaves the
victim's wallet showing nothing — "I didn't sign anything" is not exonerating.
The audit value here is verifying the **rendering + simulation controls** exist;
their absence is the vulnerability even without malicious code in the bundle.
