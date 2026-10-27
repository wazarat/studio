# What is ERC-8004

**Not started.** The Agent / ERC-8004 product track is not started. These pages are retained for reference only. Do not treat register/browse copy below as a shipped CanHav product commitment.

ERC-8004 defines on-chain infrastructure for **agent identity** (and related reputation). Public registry deployments exist independently of CanHav. CanHav does not own those registries, and Agent Launch as a CanHav product track is not started.

## Identity Registry

| Property | Detail |
|----------|--------|
| Standard role | Agents are **ERC-721** tokens |
| Pattern | ERC-1967 proxy to a verified implementation |
| CanHav role | Client + indexer against the public testnet deployment |

Minting / registering an agent creates a transferable identity NFT with an associated registration URI (URL or inline `data:` URI).

## Reputation Registry

The Reputation Registry is a sibling ERC-8004 contract. CanHav currently uses it mainly for **wiring checks** (for example, confirming `getIdentityRegistry()` points at the configured Identity Registry). Full reputation product flows are out of scope for v1. See [Roadmap](roadmap.md).

## Testnet vs mainnet

Deployments differ by a vanity address prefix:

| Network | Identity Registry prefix |
|---------|--------------------------|
| Base Sepolia (testnet) | `0x8004A818…` |
| Mainnet | `0x8004A169…` |

Mixing them up can fail **silently** if you only glance at “8004” in the address. CanHav’s site, verify script, and agents indexer **refuse** any Identity Registry that does not start with the testnet prefix.

## Related

- [Registry addresses](registry-addresses.md)
- [Register an agent](register-an-agent.md)
