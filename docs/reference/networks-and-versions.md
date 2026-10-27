# Networks and versions

**Available now** for Token Launch addresses.

**Deferred:** Foundry scaffold generator (not a shipped product feature).

**Not started:** Agent / ERC-8004 as a product track. Registry address pages under Agent Launch are historical reference only.

## Token Launch

| Item | Robinhood Chain Testnet | Arbitrum Sepolia |
|------|-------------------------|------------------|
| Chain ID | `46630` | `421614` |
| Live launcher (the `/launch` path) | **CurveLauncher** `0xb2e1F2df7775d17CE70c8CE7586c7bb01bD10981`, since 2026-09-29 | **CurveLauncher** `0x6Dde90B06b920565ccBA93D8ad7d5AfE5846426f`, since 2026-10-02 |
| Live factory (script launches) | TokenFactory **v4** | TokenFactory |
| Paused factories | v1, v2, v3 | None |
| Timelock | One per chain, minDelay 300 seconds | One per chain, minDelay 300 seconds |
| Launch fee | 0.0002 ETH | 0.0002 ETH |
| Indexer | One instance per chain | One instance per chain |

The curve parameters (0.1 ETH threshold, 80% on the curve, 60 second window, 20% snipe tax, 0.005 ETH developer buy cap) are the same on both chains.

Full address tables: [Contract addresses](../token-launch/contract-addresses.md).

## Related

- [Fees and economics](../token-launch/fees-and-economics.md)
- [Contract guarantees](../token-launch/contract-guarantees.md)
- [Deploy paths](../token-launch/deploy-paths.md)
