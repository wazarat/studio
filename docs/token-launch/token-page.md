# The token page

**Available now.**

Every launched token has a public page at `/launch/t/<address>`. It works for tokens on either chain; the page finds the chain from the address. No account or wallet is needed to read it.

## Layout, top to bottom

| Section | What it shows |
|---------|---------------|
| Header | Image, name, ticker, and whether it is a curve launch. |
| About | The description, the creator's address, the launch date, the fixed supply, the chain, a copy-address button and links to the explorer and any X, Telegram or website. |
| Project and commitment | The studio project the token is linked to, the commitment it made on-chain, and the fees its contracts charge. |
| Trade | The curve's progress toward graduation and the buy and sell panel. See [Buying and selling](trading.md). |
| Market | Four figures and a chart. See below. |
| Recent trades | Every buy and sell, newest first, ten to a page. |
| On-chain record | Token and creator addresses, the description hash, the journey hash, the salt, the launch fee paid, the launch transaction, the block and the network. |
| Below | Vesting, escrow, sales, and the commitment document with its progress updates, when the token has them. |

## About

The description text is stored off-chain. The page shows it only when it re-hashes to the `descriptionHash` in the launch event. If nothing matches, the page says no verified description is on record.

## Project and commitment

- **Project.** A linked project shows its name and a link only once it is published. An unpublished one shows its sectors and modules without the name.
- **Commitment.** "Launched without a commitment", or how many milestones were committed, with a link to the document further down the page.
- **Fees.** What the contracts charge: nothing on the curve, 0.30% in the pool after graduation, the snipe window, locked liquidity.

These contracts have no creator trading fee and no fee sharing with holders. The card says so.

## Market figures

Everything is in testnet ETH. There are no USD figures, because testnet ETH has no market price.

| Tile | Meaning |
|------|---------|
| Price | ETH per token, from the curve's reserves, or from the pool's reserves after graduation. |
| Market cap | Price times the total supply. |
| Raised or Liquidity | ETH raised against the 0.1 ETH threshold while on the curve; the pool's ETH reserve after graduation. |
| Market | Bonding curve, Pool, or No market yet. |

## The chart

The chart plots market cap in ETH over time, with ranges of 5 minutes, 1 hour, 6 hours, 1 day and all time. Hover to read the price at a point.

Know its limits:

- It is drawn from the price each trade executed at, not from candles.
- It uses the most recent 1000 trades on the curve and the most recent 1000 in the pool.
- On a curve buy inside the snipe window, the tax is left out of the price.
- A range with no trades draws a flat line at the last known price. A token with no trades at all shows a note instead of a chart.

## Recent trades

Each row shows the direction, the token amount, the trader, the ETH amount, whether it happened on the bonding curve or in the pool, and its age. The launcher's own first buy is marked "developer". A buy inside the snipe window shows the tax it paid. The trader links to the transaction on the explorer.

A holders list is not available.

## Owner controls

Two buttons appear across from the token's name, only for the signed-in CanHav account the launch is recorded to:

| Button | What it does |
|--------|--------------|
| Link a project (or Change) | Links the launch to one of your studio projects on the same chain, starts a new project for the token, or unlinks. |
| Agent prompt | Opens a prompt to paste into an AI IDE so an agent can read the launch over MCP. |

Everyone else sees neither. See [Projects and launches](projects-and-launches.md) and [Markdown export and MCP](../ai/export-and-mcp.md).

Separately, the wallet that created the token sees its creator actions further down the page (escrow, sales and progress updates) when the token has a commitment with milestones. Those depend on the connected wallet, and like trading they are shown only while you are signed in to a CanHav account.

## If the page cannot load the token

| Message | Meaning |
|---------|---------|
| Not indexed yet | The launch is seconds old, or the address is not a CanHav launch. Refresh shortly, or check the explorer. |
| Indexer unreachable | The page cannot read launch data right now. The token itself is unaffected. |

## Related

- [Explore tokens](explore-tokens.md)
- [Buying and selling](trading.md)
- [Bonding curve](bonding-curve.md)
