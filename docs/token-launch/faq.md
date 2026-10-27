# Token Launch FAQ

**Available now** (Token Launch FAQ).

## Which chains can I launch on?

Robinhood Chain Testnet (`46630`) and Arbitrum Sepolia (`421614`). Pick one at the top of the launch form. A launch started from a studio project goes on that project's chain. See [Network setup](network-setup.md).

## Do I need a CanHav account to launch?

Yes. The launch form opens once you are signed in, and buying, selling and creator actions on a token page need an account too. Your launch is recorded to your account, so it shows in the studio, can be linked to a project, and comes with a prompt for reading it over MCP. Reading token pages and Explore needs no account. See [Clerk accounts](../accounts/clerk-accounts.md).

## Why does my wallet show as disabled?

Keplr and HashPack cannot add custom EVM testnets. Use a wallet that can. See [Network setup](network-setup.md).

## Launch fails with insufficient funds

You need testnet ETH for the launch fee, your developer buy if you set one, and gas, on the chain you are launching on. The form tells you the total. On Robinhood Chain Testnet use the [faucet](https://faucet.testnet.chain.robinhood.com); on Arbitrum Sepolia use any public faucet for that network.

## Can I change my token after launch?

No. Name, ticker, supply, image, description and commitment are fixed in the launch transaction. See [The launch form](launch-form.md#fixed-at-launch).

## Can I add a commitment later?

No. The commitment hash is part of the launch. A token launched without one cannot use milestone escrow, allocation sales or progress updates.

## Can I add vesting from the launch form?

No. The form puts the whole supply on the bonding curve. Vesting wallets exist only for launches made by script through a TokenFactory. See [Vesting](vesting.md).

## My token page says "not indexed yet"

The indexer takes a moment to see a new launch, usually under a minute. Refresh, or check the transaction on the chain's explorer.

## Why did my buy get fewer tokens than I expected?

In the first 60 seconds after launch every buy pays a 20% snipe tax, which is held for the graduation pool. The quote in the trade panel already includes it. See [Buying and selling](trading.md).

## What happens when the curve reaches 0.1 ETH?

It graduates in the same transaction. The raised ETH, the tax and the reserved 20% of the supply seed a pool, and that liquidity is locked. Trading continues in the pool. See [Bonding curve](bonding-curve.md).

## Is there a creator fee or holder fee sharing?

No. The curve charges no trade fee, a graduated pool charges 0.30% that stays in the pool, and nothing is paid to the creator or to holders.

## Does the token page show USD prices or holders?

No. Prices and market cap are in testnet ETH, which has no market price, and token transfers are not indexed, so there is no holders list.

## I launched on an older factory. Is my token dead?

No. On Robinhood Chain Testnet the v1 to v3 factories are **paused for new launches** only. Existing tokens remain live and indexed. New launches from the site go through the CurveLauncher.

## Predicted token address does not match what I calculated offline

Use the contract's own prediction view: the launcher's `predictTokenAddress` for a curve launch, or the factory's for a script launch. Both clone with Solady LibClone, which is not byte-identical to classic ERC-1167 / OpenZeppelin Clones init code.

## Explore page is empty or errors

That chain's indexer may be offline or catching up. Check the explorer for your transaction, then retry. See [Explore tokens](explore-tokens.md).

## Can CanHav pause my token?

No. A launcher pause stops new launches and curve buys; a factory pause stops new factory launches. Neither pauses a token, and curve sells always work. See [Governance](governance.md).

## Is this mainnet?

No. Token Launch runs on two **testnets** only. See [Risks](risks.md).

## Where is Agent Launch documented?

See [Agent Launch overview](../agent-launch/overview.md). That track is not started.
