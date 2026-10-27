# Buying and selling

**Available now** on Robinhood Chain Testnet and Arbitrum Sepolia.

Every token page has a **Trade** panel. Where a trade goes depends on the token's stage: the bonding curve before graduation, the pool after it. Both are paid in testnet ETH. You need a connected wallet to trade; the panel shows a connect button when there is none.

## On the curve

| Action | How it works |
|--------|--------------|
| Buy | Enter an ETH amount. The panel shows the tokens you get from the launcher's own quote. |
| Sell | Enter a whole number of tokens. The panel shows the ETH you get. A sell is two wallet confirmations: an approval, then the sell. |
| Slippage | 1%, 3% or 5%, 3% by default. If the price moves further than that before your transaction lands, it reverts and nothing is spent but gas. |

Things to know:

- **Snipe tax.** For the first 60 seconds after launch every buy pays a 20% tax, which is held and added to the pool at graduation. The panel shows the tax in the quote and a countdown. Sells are never taxed. See [Bonding curve](bonding-curve.md).
- **No trade fee.** The curve charges nothing per trade.
- **The last buy.** A buy that would take the curve past its 0.1 ETH threshold is filled up to the threshold and the rest of the ETH is refunded in the same transaction. That buy also graduates the curve.
- **Sells always work.** The launcher can be paused, which stops new launches and buys. Sells cannot be paused.

## After graduation

Once 0.1 ETH has been raised the curve closes and the same panel trades against the pool.

| Action | How it works |
|--------|--------------|
| Buy | Enter an ETH amount. The quote mirrors the pool contract's math. |
| Sell | Enter a whole number of tokens. Approval, then the swap. |
| Slippage | Fixed at 1%. |
| Fee | 0.30% of each swap stays in the pool for liquidity. A graduated pool has no protocol fee. |

The liquidity in a graduated pool belongs to the launcher contract, which has no way to withdraw it. Nobody can add to or remove that position from the site.

## Tokens that never had a curve

Tokens launched by script through a TokenFactory have no curve. They trade only if their creator opened a pool and added liquidity. On such a token the creator sees the pool controls (create a pool, add or withdraw liquidity, claim fees) in the same panel. See [AMM and fees](amm-and-fees.md).

## What you see afterwards

The page refreshes a few seconds after a trade confirms. The trade appears under Recent trades and on the chart. See [The token page](token-page.md).

## Related

- [Bonding curve](bonding-curve.md)
- [AMM and fees](amm-and-fees.md)
- [Fees and economics](fees-and-economics.md)
- [Risks](risks.md)
