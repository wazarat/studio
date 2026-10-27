# Quickstart

**Available now** on Robinhood Chain Testnet and Arbitrum Sepolia.

From nothing to a live, tradable testnet token in five steps. You need a CanHav account, a browser wallet and a little testnet ETH. Sign in first, since the launch form only opens for a signed-in account.

## 1. Get testnet ETH

Pick a chain and fund your wallet on it. See [Network setup](network-setup.md) for both networks and the faucet. About 0.001 ETH covers the 0.0002 ETH launch fee and gas. Add more if you want a developer buy.

## 2. Open Launch and pick the chain

Open a project in the studio and click **Launch a token from this project** (the form at `/launch`). Choose **Robinhood testnet** or **Arbitrum Sepolia** under Chain, then connect your wallet. Approve the network switch if the wallet asks.

## 3. Describe the token

On step 1, **Token**, enter a name, a ticker, a short description and an image. These four are required. X, Telegram, website, a developer buy, a commitment and a project are all optional. Every field is explained in [The launch form](launch-form.md).

## 4. Review and launch

Step 2, **Launch**, shows what will be sent: supply, chain, launch fee, your developer buy and the total ETH needed. Press **Launch token** and confirm once in your wallet. The launch is a single transaction.

## 5. Open the token page

The success screen shows the token address. **View token page** opens it at `/launch/t/<address>`, where anyone can [buy and sell](trading.md) on the bonding curve. The page fills in once the indexer has seen the launch, usually within a minute.

## What happens next

- The token trades on its [bonding curve](bonding-curve.md) until 0.1 ETH has been raised, then in a pool whose liquidity is locked.
- The launch is recorded to your account and appears in the [studio](../ideation/studio.md). From there you can [link it to a project](projects-and-launches.md) and get a prompt that lets an AI agent [read it over MCP](../ai/export-and-mcp.md).
- Nothing about the token can be changed after launch. See what is fixed in [The launch form](launch-form.md#fixed-at-launch).

{% hint style="warning" %}
Testnet only. Read [Risks](risks.md).
{% endhint %}
