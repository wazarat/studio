# Contract guarantees

**Available now** on Robinhood Chain Testnet and Arbitrum Sepolia for tokens launched through the CanHav CurveLauncher or TokenFactory. Both clone the same token implementation.

This page states what a CanHav launch token **can and cannot** do. Claims below are about the token implementation cloned by the factory, not about every third-party contract a team may deploy later.

## What the token cannot do

| Guarantee | Meaning |
|-----------|---------|
| No mint after deployment | Supply is fixed at initialize. There is no mint function for later inflation. |
| No pause on the token | The token itself cannot be paused. A launcher or factory pause only stops **new** launches, and curve buys. |
| No freeze / blacklist | No account freeze or blacklist on the token. |
| No upgrade | Not a transparent upgradeable proxy on the token. No owner who can swap logic. |
| No owner | The token has no owner role for admin privileges after initialize. |

CanHav takes **zero percent of token supply**. That is enforced by the absence of a mint path for the platform, not by a policy document.

## What a curve launch guarantees

| Guarantee | Meaning |
|-----------|---------|
| Locked graduation liquidity | The pool the launcher seeds at graduation holds its shares in the launcher. LaunchAMM shares cannot be transferred or burned and the launcher has no `removeLiquidity` path. |
| Sells always work | `sell` on the launcher is never pausable. A pause stops new launches and buys only. |
| Curve parameters are immutable | Threshold, curve share, virtual reserve, window, tax and the developer buy cap are set at deploy and cannot change. |
| Launch fees never touch curve ETH | `withdraw` moves only accrued launch fees to the treasury. |

See [Bonding curve](bonding-curve.md).

## Source verification

The launcher and factory clone one token implementation. New tokens inherit that source rather than deploying opaque bytecode.

On Robinhood Chain Testnet every contract below is source-verified on the explorer. On Arbitrum Sepolia the CurveLauncher and the TokenFactory are verified; the other contracts are the same code and are still waiting for verification on Blockscout.

### Robinhood Chain Testnet

| Contract | Address |
|----------|---------|
| CurveLauncher | [`0xb2e1F2df7775d17CE70c8CE7586c7bb01bD10981`](https://explorer.testnet.chain.robinhood.com/address/0xb2e1F2df7775d17CE70c8CE7586c7bb01bD10981) |
| TokenFactory v4 (live) | [`0x30Db3A828F65B92434c6aDB27AEeD01850277b08`](https://explorer.testnet.chain.robinhood.com/address/0x30Db3A828F65B92434c6aDB27AEeD01850277b08) |
| LaunchToken implementation | [`0x3E8c9be8BB486abEc132B0d1C35266b2336b129B`](https://explorer.testnet.chain.robinhood.com/address/0x3E8c9be8BB486abEc132B0d1C35266b2336b129B) |

### Arbitrum Sepolia

| Contract | Address |
|----------|---------|
| CurveLauncher | [`0x6Dde90B06b920565ccBA93D8ad7d5AfE5846426f`](https://arbitrum-sepolia.blockscout.com/address/0x6Dde90B06b920565ccBA93D8ad7d5AfE5846426f) |
| TokenFactory | [`0xdC3521DDEFfca6825771da6c23679A7BA1E82475`](https://arbitrum-sepolia.blockscout.com/address/0xdC3521DDEFfca6825771da6c23679A7BA1E82475) |
| LaunchToken implementation | [`0x3E8c9be8BB486abEc132B0d1C35266b2336b129B`](https://arbitrum-sepolia.blockscout.com/address/0x3E8c9be8BB486abEc132B0d1C35266b2336b129B) |

Always confirm on the chain's own explorer, and read an address together with its chain. See [Contract addresses](contract-addresses.md).

## What this does not guarantee

- It does not guarantee that a team’s **other** contracts (vaults, routers, oracles) are immutable or ownerless.
- It does not guarantee vesting, escrow, or sale terms unless those contracts are used.
- It does not enforce a commitment. A committed document proves what was said at launch; only the supply is enforced.
- It does not make a testnet token a mainnet product or an investment.

## Related

- [Risks](risks.md)
- [Fees and economics](fees-and-economics.md)
- [Governance](governance.md)
- [Contract addresses](contract-addresses.md)
- [Create a token](create-a-token.md)
