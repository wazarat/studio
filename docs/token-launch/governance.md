# Governance

**Available now.**

Token Launch separates **immutable after launch** from **timelocked admin**. Each chain has its own deployment and its own timelock. Nothing on one chain governs the other.

## TimelockController

| Item | Detail |
|------|--------|
| Address | One per chain. See [Contract addresses](contract-addresses.md) |
| Owns | On its own chain: the CurveLauncher, the TokenFactory, LaunchAMM admin surfaces, and FeeSplitter payee config |
| minDelay (testnet) | 300 seconds on both chains. Anything closer to production should use 24h+. |
| Proposer | Deployer EOA (testnet), the same address on both chains |
| Executor | Open |
| Admin | None on the timelock itself |

Every sensitive admin change (launch fee, treasury, pauser, implementation bumps, unpause) waits out the public delay.

## What can change, and what cannot

| Item | Can it change? |
|------|----------------|
| Launch fee | Yes, through the timelock, up to the hard cap `MAX_LAUNCH_FEE = 0.05 ether` |
| Default protocol fee for new opted-in pools | Yes, through the timelock, up to 50 bps. Existing pools keep the rate they were created with |
| Curve threshold, curve share, snipe window and tax, developer buy cap | No. Immutables of the launcher |
| A launched token (supply, name, ticker) | No. The token has no owner |
| A graduated pool's liquidity | No. It cannot be withdrawn |

## What pause does

- **Launcher pause** stops new launches and curve **buys**. Curve **sells** can never be paused.
- **Factory pause** stops new factory launches.
- Already launched tokens are not paused by either. The token has no pause.
- **Pausing is immediate.** A pauser address (the deployer on testnet) can pause without waiting. **Unpausing** goes through the timelock and waits out the delay.
- On Robinhood Chain Testnet the older factories (v1 to v3) are paused permanently after migrations; their tokens stay live and indexed.

## Reading the governance page

The site shows all of this live at `/launch/governance`, with a toggle for each chain:

| Section | What it shows |
|---------|---------------|
| Economic terms | Everything the platform charges, with the current value read from the chain, the ceiling, and what enforces it |
| Trading (AMM) | The pool fee terms |
| Timelock operations | Every admin action, past and pending, from the timelock's event log, decoded |

An agent can read the same through the `get_launch_governance` MCP tool, which takes an optional `chain`. See [Markdown export and MCP](../ai/export-and-mcp.md).

## Related

- [Fees and economics](fees-and-economics.md)
- [AMM and fees](amm-and-fees.md)
- [Contract guarantees](contract-guarantees.md)
- [Contract addresses](contract-addresses.md)
