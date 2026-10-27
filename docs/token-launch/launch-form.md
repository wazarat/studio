# The launch form

**Available now** on Robinhood Chain Testnet and Arbitrum Sepolia.

The launch form (`/launch`), opened from a project with **Launch a token from this project**, is a two-step form. Step 1, **Token**, collects what the token is. Step 2, **Launch**, is the review and the one transaction. This page explains each part. For what the transaction does on-chain, see [Create a token](create-a-token.md).

## Reading the form

The form is quiet by design. Each field keeps one short line under it; anything longer sits behind the small info icon beside the label, and a collapsed row opens on click. The card on the right reads **Launch status** with three chips, the chain, the wallet and the token readiness, so the form itself carries no state text. The sections are Token, Links, First buy, Commitment and Project.

## Chain

The chain chooser at the top picks where the token launches: Robinhood Chain Testnet or Arbitrum Sepolia. It is hidden when the launch starts from a studio project or from a token design linked to one, because that launch goes on the project's chain.

## Step 1: Token

| Field | Required | Rules |
|-------|----------|-------|
| Name | Yes | Letters, numbers, spaces. Max 32 characters. |
| Ticker | Yes | Uppercase letters and numbers. Max 10 characters. |
| Description | Yes | Max 256 characters. No links. |
| Image | Yes | PNG, JPG, WEBP, or GIF. Max 4 MB. |
| X profile | No | The handle only. Max 15 characters. |
| Telegram | No | The username only. 5 to 32 characters. Not committed on-chain. |
| Website | No | A full `http(s)` URL. |
| Developer buy | No | 0.0001 to 0.005 ETH. Your first buy on the curve, inside the launch transaction, exempt from the snipe tax. |
| Add a commitment | No | A toggle. See below. |
| Project | No | Shown when you are signed in. See below. |

Supply is not a field. A launch from the form mints 1 billion tokens. A launch started from a published token design keeps that design's total.

### Add a commitment

Off by default. Switched on, it asks why the token exists (80 to 2000 characters), the supply rationale (40 to 1000 characters) and two to five dated milestones. The document is stored off-chain and its hash goes on-chain with the token, where it can never be changed. See [Journey and credibility](journey-and-credibility.md).

A commitment is what milestone [escrow](milestone-escrow.md), [allocation sales](allocation-sales.md) and [progress updates](journey-updates.md) work against. A token launched without one cannot use them later, and its token page says "Launched without a commitment".

### Project

Optional, and offered only when you are signed in to CanHav and the launch did not start from a project or a design.

| Choice | What it does |
|--------|--------------|
| No project | The launch is recorded to your account with no project. You can link one later. |
| Link one of my projects | Lists your studio projects on the same chain as the launch. |
| Start a project for this token | After the launch succeeds, a draft project is created, named after the token, on the token's chain, and linked to it. |

See [Projects and launches](projects-and-launches.md).

## Step 2: Launch

The review lists the token, the project when there is one, the supply and how much of it goes on the curve, the commitment, the network, the launch fee read live from the launcher, your developer buy and its opening price, and the total ETH needed.

**Launch token** runs these steps in order and stops at the first failure, before anything irreversible:

1. Checks the wallet is on the right chain and holds enough ETH.
2. Simulates the launch against the launcher.
3. Uploads the image.
4. Stores the description, and the commitment document when there is one.
5. Asks your wallet to confirm one transaction.

## The success screen

After the transaction confirms you see the token address, your developer buy and opening price when you made one, the curve's progress, and links to the token page and the transaction.

The launch is recorded to your CanHav account, along with the project you picked or the new draft. The screen then shows a prompt you can paste into an AI IDE to read the launch over MCP. See [Markdown export and MCP](../ai/export-and-mcp.md).

The launch form needs a signed-in account, so every launch made through it is attached to one.

## Fixed at launch

Nothing about a token can be edited after the transaction.

| Fixed forever | Detail |
|---------------|--------|
| Name, ticker, supply | Set in the token contract. There is no mint function after launch. |
| Image, X handle, website | Carried in the launch event. |
| Description | Its hash is in the launch event. The text is shown only when it matches. |
| Commitment | Its hash is in the launch event, or zero when there is none. |
| Curve terms | Threshold, curve share, snipe window and tax are constants of the launcher. |

What the launcher of a token **cannot** do: mint more, pause or freeze the token, block a holder, add a tax, change the curve, or withdraw the pool's liquidity after graduation.

What can still happen after launch: trading, graduation, linking the launch to a studio project (a CanHav record, not an on-chain change), and, with a commitment, escrow, sales and progress updates.

## Related

- [Quickstart](quickstart.md)
- [Create a token](create-a-token.md)
- [Bonding curve](bonding-curve.md)
- [Deploy paths](deploy-paths.md)
