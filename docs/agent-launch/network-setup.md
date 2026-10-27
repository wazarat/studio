# Network setup

**Not started.** The Agent / ERC-8004 product track is not started. These pages are retained for reference only. Do not treat register/browse copy below as a shipped CanHav product commitment.

Agent Launch runs on **Base Sepolia**, not Robinhood Chain.

## Chain parameters

| Parameter | Value |
|-----------|-------|
| Name | Base Sepolia |
| Chain ID | `84532` |
| Explorer | [base-sepolia.blockscout.com](https://base-sepolia.blockscout.com) |
| Public RPC | `https://sepolia.base.org` (rate-limits aggressively; prefer Alchemy or similar for sustained use) |

## Wallets

Most wallets that already know Base Sepolia work. The CanHav agents picker disables wallets that cannot operate on this chain (for example HashPack is Hedera-only).

Unlike Token Launch, Keplr’s “cannot add custom EVM testnets” limitation is less relevant here because Base Sepolia is widely preconfigured.

## Checklist

1. Switch wallet to Base Sepolia (`84532`).
2. Fund the wallet with Base Sepolia ETH from a public faucet.
3. Open `/agents` on the CanHav site and confirm the registry status card shows a healthy Identity Registry.

## Related

- [Registry addresses](registry-addresses.md)
- [Register an agent](register-an-agent.md)
