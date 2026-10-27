# Token Launch overview

**Available now** on Robinhood Chain Testnet and Arbitrum Sepolia.

Token Launch is CanHav's testnet launchpad. It runs on two chains from the same contracts: **Robinhood Chain Testnet** and **Arbitrum Sepolia**. The [studio](../ideation/studio.md) (projects and token designs) is available alongside it. Agent / ERC-8004 is **not started**.

You create a fixed-supply ERC20 whose supply goes onto a [bonding curve](bonding-curve.md), and you can make your first buy inside the launch. You can also commit a plan on-chain as a hash, so it can be checked later. That commitment is optional. At 0.1 ETH raised the curve seeds a pool whose liquidity is locked forever. Supporting contracts cover milestone escrow, progress updates, allocation sales, and a minimal AMM.

CanHav has no affiliation with Robinhood. Robinhood Chain does not distribute to Robinhood brokerage customers. See [Welcome](../general/welcome-to-canhav.md).

## Status

| Item | Detail |
|------|--------|
| Networks | Robinhood Chain Testnet (chain ID `46630`) and Arbitrum Sepolia (chain ID `421614`). See [Network setup](network-setup.md). |
| Launcher | **CurveLauncher**, one per chain. Every launch from `/launch` goes through it. A TokenFactory is also deployed on each chain for launches made by script; on Robinhood Chain Testnet factory v4 is live and v1 to v3 are paused. Every token stays indexed and browsable. |
| Product UI | The launch form (`/launch`), opened from a project with **Launch a token from this project**, and the Explore board (`/explore`, reachable by URL) on canhav.com. Neither sits in the navigation; a launch starts from a project in the studio. |
| Audience | Builders and testers. Not a mainnet product. |

{% hint style="warning" %}
Testnet only. Tokens here have no value. Do not treat launches, fees, or liquidity as production or investment advice. Read [Risks](risks.md).
{% endhint %}

## What you can do

1. [Set up the network](network-setup.md) (wallet, testnet ETH), or follow the [Quickstart](quickstart.md)
2. Fill in [the launch form](launch-form.md) and launch. [Create a token](create-a-token.md) explains what the transaction deploys, and [Bonding curve](bonding-curve.md) explains the market it opens
3. [Buy and sell](trading.md) on the curve, then in the pool after graduation
4. Read [the token page](token-page.md) and browse [Explore](explore-tokens.md)
5. [Link the launch to a project](projects-and-launches.md) in the studio, and read it from an AI agent over [MCP](../ai/export-and-mcp.md)
6. With a commitment, use [escrow](milestone-escrow.md), [updates](journey-updates.md) and [sales](allocation-sales.md) against your milestones
7. Review [contract guarantees](contract-guarantees.md), [fees and economics](fees-and-economics.md), [governance](governance.md), and [contract addresses](contract-addresses.md)

## Design principles

- **Pause on the launcher and factory, not on tokens.** Stopping new launches does not freeze existing tokens, and sells on a curve always work.
- **Liquidity locked by construction.** A graduated pool's shares sit in a contract with no way to remove them.
- **Hashes for credibility.** The description, and the commitment when there is one, are recorded as hashes in the launch event.
- **Admin-less where it matters.** Escrow, updates, and sales have no owner.
- **Timelock for admin knobs.** Launcher, factory and AMM fee and config changes wait out a public delay. Each chain has its own timelock.
- **Zero supply take.** No mint path for the platform after initialize.

## Next

Start with the [Quickstart](quickstart.md) or [Network setup](network-setup.md).
