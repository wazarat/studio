# AMM and fees

**Available now.**

**LaunchAMM** is a minimal AMM for token/ETH pools, deployed once on each chain. Protocol fee configuration is owned by that chain's timelock.

Most tokens reach it through graduation: a [bonding curve](bonding-curve.md) seeds its pool here. To trade in a pool, see [Buying and selling](trading.md).

For the full fee table (launch fee, caps, freeze-at-creation, zero supply take), see [Fees and economics](fees-and-economics.md).

## Pool mechanics

| Item | Detail |
|------|--------|
| Pair | Launch token and ETH |
| LP fee | 0.30% |
| Protocol fee | Optional, opt-in, for pools a creator opens by hand. Default 20 bps. Hard-capped at `MAX_PROTOCOL_FEE_BPS = 50`. |
| Protocol split | 70% project / 30% platform (`PROJECT_SHARE_BPS = 7000`), enforced in bytecode |
| Fee destination | [FeeSplitter](contract-addresses.md) (never an EOA as the platform sink) |
| Existing pools | Protocol fee rate **frozen at pool creation**; changing the default does not rewrite old pools |
| First liquidity | The first `addLiquidity` sets the price and is open to anyone holding the token. A pool the curve launcher seeds at graduation is created and funded in one call, so there is no gap. For a pool a creator opens by hand, another holder could set the opening price between `createPool` and the deposit; accepted on testnet. |
| Liquidity lock | None for pools a creator opens. A pool seeded by the [curve launcher](bonding-curve.md) at graduation holds its shares in the launcher forever, since shares cannot be transferred or burned and the launcher never removes liquidity. Only `MINIMUM_LIQUIDITY` (1e3 shares) burns in every pool. |
| Graduated pools | Opted out of the protocol fee. The 0.30% LP fee compounds into the locked reserves. |

## FeeSplitter

| Item | Detail |
|------|--------|
| Ownership | Timelock |
| Role | Platform fee destination; payees set via timelock; permissionless audited distributions |

## What you can change (with delay)

AMM knobs such as the default protocol fee sit behind the [TimelockController](governance.md). There is no instant admin switch on production-bound parameters. Testnet `minDelay` is 300 seconds.

## Related

- [Bonding curve](bonding-curve.md)
- [Fees and economics](fees-and-economics.md)
- [Contract guarantees](contract-guarantees.md)
- [Governance](governance.md)
- [Contract addresses](contract-addresses.md)
