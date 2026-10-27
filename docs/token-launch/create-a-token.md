# Create a token

**Available now** on Robinhood Chain Testnet and Arbitrum Sepolia.

This page explains what a launch deploys and stores. For the form itself, field by field, see [The launch form](launch-form.md).

Launches from the launch form (`/launch`, opened from a project) go through the **CurveLauncher** on the chain you pick, which puts the supply on a [bonding curve](bonding-curve.md). A TokenFactory is also deployed on each chain for launches made by script, which is the only path that can create a vesting wallet.

## What gets deployed

In one launcher call the system

1. deploys a fixed-supply **LaunchToken** clone (Solady LibClone, CREATE2 prediction) and mints the whole supply to the launcher,
2. opens the token's bonding curve and emits `TokenLaunched` (the same event the factory emits) plus `CurveCreated`, both carrying `descriptionHash` and `journeyHash` (zero when the launch has no commitment), and
3. makes your developer buy, when you set one, as the first buy on the curve.

Predicted addresses must use the launcher's own `predictTokenAddress`. LibClone bytecode is not byte-identical to classic ERC-1167, so do not reuse OpenZeppelin Clones math off-chain.

## Form rules (UI)

| Field | Rules |
|-------|--------|
| Name | Letters, numbers, spaces. Max 32 characters. Required. |
| Ticker | Uppercase letters and numbers. Max 10 characters. Required. |
| Description | Max 256 characters. No links (`http`, `www.`, or bare domain paths). Required. |
| Image | PNG, JPG, WEBP, or GIF. Max 4 MB. Required. |
| X handle | Letters, numbers, underscores. Max 15 characters. A pasted `x.com/` link or `@handle` is reduced to the handle. Optional. |
| Telegram | Letters, numbers, underscores. 5 to 32 characters. A pasted `t.me/` link or `@handle` is reduced to the username. Optional. Not committed on-chain. |
| Website | Full `http(s)` URL. Optional. |
| Developer buy | Optional ETH amount, 0.0001 to 0.005. Your first buy on the curve, inside the launch transaction, exempt from the snipe tax. See [Developer buy](#developer-buy). |
| Commitment | Optional. An off-chain document whose hash is committed on-chain. See [Journey and credibility](journey-and-credibility.md). |
| Project | Optional, signed-in accounts only. Not sent on-chain. See [Projects and launches](projects-and-launches.md). |

## What is stored where

The `TokenLaunched` event carries the name, ticker, supply, image URL, X handle, website and two hashes. The description **text** and the Telegram handle are stored in CanHav's database before the launch transaction is signed, keyed by `descriptionHash` and the creator address. The token page and the `get_launch` MCP tool show the description only when its recomputed keccak256 equals the hash in the event, so the text is tamper-evident even though it lives off-chain. Telegram has no on-chain hash and is shown as stored. The store is insert-only: the first write for a given hash and creator wins, so a public description cannot be used to overwrite a creator's Telegram link.

## Developer buy

The ETH in the Developer buy field is spent on the curve inside the launch transaction, before anyone else can trade. The tokens land in your wallet at the opening price. The buy is exempt from the snipe tax and capped at 0.005 ETH (5% of the graduation threshold), so it can never graduate the curve on its own. At the cap it takes about 14% of the supply.

The whole launch is one wallet confirmation. `msg.value` must equal the launch fee plus the developer buy exactly. The form reads both from the launcher and shows the quote from `quoteLaunch` as the opening price before you sign.

## Fees and salts

- **Launch fee:** paid in ETH to the launcher on top of the developer buy. Hard ceiling in bytecode (`MAX_LAUNCH_FEE = 0.05 ether`). Live `launchFee` is set on each chain's timelock-owned launcher, 0.0002 ETH on both chains at the time of writing.
- **userSalt:** chosen by the creator. Internally scoped as `keccak256(abi.encode(msg.sender, userSalt))` so others cannot squat your predicted address.
- **Version note:** the launcher's `TokenLaunched` carries version 1 of its own registry. The indexer tells launches apart by the emitting contract, not by the version number.

## After launch

- Your token trades on its curve until 0.1 ETH has been raised, then in the locked pool. See [Bonding curve](bonding-curve.md).
- Tokens from the factories (v1 to v4) remain live and indexed beside curve launches.
- Open [the token page](token-page.md), find it on [Explore](explore-tokens.md), or check the chain's explorer.
- The token is recorded to your CanHav account. See [Projects and launches](projects-and-launches.md).

## Next

[Bonding curve](bonding-curve.md) · [Buying and selling](trading.md) · [Journey and credibility](journey-and-credibility.md)
