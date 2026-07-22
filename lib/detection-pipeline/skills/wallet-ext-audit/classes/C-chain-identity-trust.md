# Class C — Chain identity from untrusted runtime input

**Category:** `signing-trust`
**Canonical example:** MetaMask chosen-chainId, GHSA-c2xw-px2x-pr65
**Provenance:** public advisory (GHSA-c2xw-px2x-pr65); first-party source
provided (the MetaMask static-audit writeup supplied by the operator).
**Protects:** the integrity of which chain a signature is valid for.

## Rule

The identity used in a security decision (which chain you are signing for) must
come from a trusted, user-configured value — never from a value the remote
endpoint can choose.

## Canonical example

When a custom RPC was added without an explicit chainId, the wallet called
`net_version` on the (possibly malicious) RPC and used that value for
**signing**. `net_version` is the network ID, not the EIP-155 chainId, and a
hostile RPC returns anything → cross-chain replay / wrong-chain signing: a
transaction signed "for chain X" is replayable on chain Y.

## Detect

1. **Find signing entrypoints:** `signTransaction`, EIP-155 `v` computation,
   `Common` / `@ethereumjs` chain config, `getChainId`.
2. **Backward-taint the `chainId` used at signing.**
   - Trusted = user-entered / stored config keyed by user input.
   - Untrusted = any runtime network response (`net_version`, unvalidated
     `eth_chainId` from the same RPC, fallback that queries the endpoint when
     config is missing).
   ```bash
   rg -n "net_version|networkId|getNetworkId|eth_chainId" --glob '*.{js,ts}'
   ```
3. **Flag the dangerous fallback:** "if chainId undefined → request
   `net_version` → use for signing."
4. **Confirm positive controls:** custom-network creation **requires** an
   explicit chainId; `net_version` is never conflated with `chainId`; the
   chainId bound into the signed payload is the user-configured one.

## Heuristic

*chainId used in signing is data-flow-reachable from a runtime network
response, OR custom-network creation doesn't require an explicit chainId →
"chain identity from untrusted source."*

## Generalization

The class is broader than chainId: **any value that decides whether a signature
is safe** (target contract, domain separator's `chainId`/`verifyingContract`,
account index) must trace to trusted config or explicit user confirmation, not
to a remote/dApp-supplied value. Where the untrusted value is a signing
*domain* field, cross-reference Class G (signature phishing).
