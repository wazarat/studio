# Explore tokens

**Available now.**

The Explore board (`/explore`) lists everything launched and published through CanHav, on both chains. It is reachable by URL and is not linked from the navigation, since tokens are created from a project in the studio. A toggle switches it between two views.

## Views

| View | URL | What it lists |
|------|-----|---------------|
| Tokens (the default) | `/explore` | Every token launched through CanHav, newest first. Each card shows the price and liquidity when a pool exists, or the curve price and graduation progress while the token is on its curve, plus the supply and launch date. |
| Projects | `/explore?view=projects` | Every project published from the studio, newest first. A project needs no token to be listed. Published token designs are not on the board. |

A token card opens [the token page](token-page.md) at `/launch/t/[address]`. A project card opens its public page at `/p/[slug]`.

`/projects` redirects to the Projects view, and the old `/launch/explore` redirects to `/explore`.

## What the indexer sees

Launches are indexed by a Ponder indexer, one instance per chain, so you can browse without scanning an explorer.

- Launch events from the curve launcher and every factory version (including tokens from the paused v1 to v3 factories on Robinhood Chain Testnet)
- Curve creation, buys, sells and graduation
- Vesting creation
- Escrow, updates, sale, and AMM activity

Token transfers are not indexed, so there is no holders list.

If an indexer is offline, the board and token pages for that chain say so rather than failing. On-chain truth stays on the chain's explorer: [Robinhood Chain Testnet](https://explorer.testnet.chain.robinhood.com) or [Arbitrum Sepolia](https://arbitrum-sepolia.blockscout.com).

## Related

- [The token page](token-page.md)
- [Bonding curve](bonding-curve.md)
- [Public pages](../ideation/public-pages.md)
- [Contract addresses](contract-addresses.md)
- [FAQ](faq.md)
