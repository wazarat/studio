# Fees and economics

**Available now** on Robinhood Chain Testnet and Arbitrum Sepolia. Each chain has its own deployment and its own timelock, with the same values on both. Values below are verifiable on-chain. Prefer reading live contract state for the current `launchFee` and `defaultProtocolFeeBps`; this page records the design and the last documented calibration.

## Zero supply take

CanHav takes **0% of token supply**. Enforcement is the absence of a mint function after initialize on the launch token, not a soft policy. See [Contract guarantees](contract-guarantees.md).

Allocation sales take **0% platform cut** of sale proceeds (fee-free sales contract).

## Fee switches

| Switch | Where | Current documented value | Hard cap | Who can change | Delay |
|--------|-------|--------------------------|----------|----------------|-------|
| Launch fee (`launchFee`) | CurveLauncher (the `/launch` path) and TokenFactory | **0.0002 ETH** on both contracts, on both chains | `MAX_LAUNCH_FEE = 0.05 ether` | Owner = Timelock | Timelock `minDelay` (**300 seconds** on testnet) |
| Snipe tax on curve buys | CurveLauncher | **20%** of buys in the first 60 seconds, held for the graduation pool | Immutable | Not an admin switch | N/A |
| Trade fee on the curve | CurveLauncher | **0** | Immutable | N/A | N/A |
| Default protocol fee for new opted-in pools (`defaultProtocolFeeBps`) | LaunchAMM | **20 bps** default | `MAX_PROTOCOL_FEE_BPS = 50` | AMM owner = Timelock | Same timelock delay |
| LP trading fee | LaunchAMM | **30 bps (0.30%)** to LPs | Fixed in bytecode for the pool design | Not an admin switch | N/A |
| Protocol fee split | LaunchAMM | **70% project / 30% platform** (`PROJECT_SHARE_BPS = 7000`) | Fixed constant | Not an admin switch | N/A |
| Allocation sale platform cut | AllocationSale | **0** | N/A (no cut) | N/A | N/A |

There is no creator trading fee and no fee paid to token holders anywhere in these contracts.

Factory and launcher pause stop new launches (and curve buys); sells on the curve always work. Pause is an emergency control, not a fee switch. Unpause waits on the timelock. See [Governance](governance.md).

## Existing pools are frozen at creation rate

When you create a pool and opt into the protocol fee, the pool stores its `protocolFeeBps` at creation time. Changing `defaultProtocolFeeBps` later does **not** rewrite existing pools. New pools pick up the new default; old pools keep the rate they were created with.

Verify in `LaunchAMM` on [Robinhood Chain Testnet](https://explorer.testnet.chain.robinhood.com/address/0xDd070b1f8e000D27491A3d38543ef0D72C758Df4) or [Arbitrum Sepolia](https://arbitrum-sepolia.blockscout.com/address/0x4EA372acAb7be21113f474CEd2B7b317019afeD3): createPool freezes fee; `setDefaultProtocolFeeBps` is owner-only (timelock).

## Fee destination

Platform protocol fees route to that chain's FeeSplitter ([addresses](contract-addresses.md)), never to an EOA as the platform sink. Payee changes are timelocked.

## Timelock

| Item | Value |
|------|-------|
| Address, Robinhood Chain Testnet | [`0x080cCDC07e2a0a5D11e9dDaA873ea68F540109ae`](https://explorer.testnet.chain.robinhood.com/address/0x080cCDC07e2a0a5D11e9dDaA873ea68F540109ae) |
| Address, Arbitrum Sepolia | [`0xeD66C31FFAC1C5dCf4f327536a7540B22DF2B5E1`](https://arbitrum-sepolia.blockscout.com/address/0xeD66C31FFAC1C5dCf4f327536a7540B22DF2B5E1) |
| minDelay (testnet) | **300 seconds** on both |
| Owns | On its own chain: CurveLauncher and TokenFactory admin surfaces, LaunchAMM admin surfaces, FeeSplitter payee config |
| Production note | Anything closer to production should use 24h+ |

## How to verify independently

1. Open each address on its chain's explorer. See [Contract addresses](contract-addresses.md).
2. Read `launchFee` and `MAX_LAUNCH_FEE` on the launcher and the factory, and the curve immutables on the launcher (see [Bonding curve](bonding-curve.md)).
3. Read `defaultProtocolFeeBps`, `MAX_PROTOCOL_FEE_BPS`, and `PROJECT_SHARE_BPS` on the AMM.
4. Read `minDelay` on the TimelockController.
5. For a live pool, inspect its stored `protocolFeeBps` and confirm it does not change when the default changes.

Product UI: `/launch/governance` shows these terms live for either chain. See [Governance](governance.md).

## Related

- [Contract guarantees](contract-guarantees.md)
- [AMM and fees](amm-and-fees.md) (shorter overview)
- [Governance](governance.md)
- [Contract addresses](contract-addresses.md)
