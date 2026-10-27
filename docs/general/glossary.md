# Glossary

**Available now** as reference. Terms for Token Launch, Projects, and Agent Launch match how CanHav uses them in product and contracts.

## Product

| Term | Meaning |
|------|---------|
| CanHav | Research platform and testnet product suite. Product site: [canhav.com](https://canhav.com). |
| Token Launch | Testnet launchpad on Robinhood Chain Testnet and Arbitrum Sepolia for launching fixed-supply tokens on a bonding curve, with optional commitments, sales, and AMM liquidity. Available now. |
| Projects | Ideation studio with independent Product and Token design tracks, computed outputs, and public pages. Available now. |
| Agent Launch | Intended ERC-8004 agent identity track. **Not started.** |
| Journey | Off-chain document describing a token's plan and milestones. Optional. When a launcher adds one, its hash is committed on-chain at launch. A launch from a published design commits the design's snapshot instead, and the design's milestones play the same role. |
| Research preview | Content and software that is experimental, testnet-only, and not financial advice. |
| Status declaration | Team-stated status for legal, governance, or security work (already in place, handled by legal/ops, planned before mainnet, not yet). Not enforced by the token contract. |

## Projects

| Term | Meaning |
|------|---------|
| Product track | Ideation document for what you are building (sector, users, architecture, security). |
| Token track | Ideation document for token design (eight sections from rationale through post-launch). |
| Computed outputs | Float, FDV:float, unlock calendar, and warnings derived from token design answers. |
| Clerk | Account provider for the studio. Available now. |
| Studio | Where a signed-in account sees its launches, projects and token designs (`/studio`). |
| Linked launch | A launched token tied to a studio project. A CanHav record, not an on-chain change. |

## Token Launch

| Term | Meaning |
|------|---------|
| Robinhood Chain Testnet | Arbitrum Orbit testnet, one of the two chains Token Launch runs on. Chain ID `46630`. Not affiliated with Robinhood brokerage distribution. |
| Arbitrum Sepolia | Arbitrum's testnet, the other chain Token Launch runs on. Chain ID `421614`. |
| CurveLauncher | The contract behind `/launch` since September 29, 2026. Clones a LaunchToken, holds the supply on a bonding curve, taxes early buys into a pot, and at 0.1 ETH raised seeds a LaunchAMM pool whose shares it keeps forever. |
| Bonding curve | A constant-product price curve with virtual reserves. Buys move ETH in and tokens out so the product of the reserves never falls; the price is the ratio of the two. |
| Virtual reserves | The starting reserves a curve prices against before any real ETH has arrived. Derived so the curve's end price equals the pool's opening price. |
| Snipe tax | 20% taken off buys in the first 60 seconds after launch and held for the graduation pool. Sells and the developer's first buy are exempt. |
| Graduation | The moment 0.1 ETH of real ETH has been raised on a curve. The launcher creates and seeds the pool in that same transaction and trading moves there. |
| TokenFactory | Contract that deploys token clones (CREATE2 / LibClone) without a curve, for launches made by script, optionally with a vesting wallet. Deployed on both chains. On Robinhood Chain Testnet v4 is live and the older factories are paused; their tokens remain indexed. |
| LaunchToken | Fixed-supply ERC20 implementation cloned per launch. No mint after initialize; no owner; not upgradeable. |
| Launch fee | ETH paid to the launcher (or the factory) on launch, on top of any developer buy. Hard-capped in bytecode (`MAX_LAUNCH_FEE`); current documented value 0.0002 ETH on both chains. |
| userSalt | Creator-chosen salt. Combined with `msg.sender` so predicted addresses cannot be front-run by others. |
| journeyHash | On-chain commitment to the journey document, or to a published token design's snapshot when the launch was made from a design. Zero when the launch made no commitment. |
| descriptionHash | On-chain commitment to the short form description field. The text itself is stored off-chain and displayed only when it re-hashes to this value. |
| Vesting wallet | Clone that locks a percent of supply for a beneficiary with duration and optional cliff. Created only by factory launches made by script, not by the launch form. |
| MilestoneEscrow | Admin-less singleton for milestone-dated token lockups. |
| JourneyUpdates | Admin-less singleton that anchors content-addressed progress updates. |
| AllocationSale | Admin-less fixed-price sale contract. Fee-free; proceeds unlock on milestone dates. |
| LaunchAMM | Minimal token/ETH AMM. LP fee plus optional protocol fee routed through FeeSplitter. Per-pool protocol fee frozen at creation. Pools seeded by the curve launcher hold their shares in the launcher forever. |
| FeeSplitter | Timelock-owned destination for platform fee share; permissionless distributions to configured payees. |
| TimelockController | Owns launcher, factory and AMM admin knobs. One per chain. Admin changes wait out a public delay (300s on testnet). |
| Indexer | Ponder app that indexes launch events for explore and token detail pages. One instance per chain. |

## Agent Launch

| Term | Meaning |
|------|---------|
| Base Sepolia | Base L2 testnet. Chain ID `84532`. Home of CanHav Agent Launch. |
| ERC-8004 | Standard for on-chain agent identity and related registries. |
| Identity Registry | Public ERC-721 registry where each agent is a token. CanHav does not own this contract. |
| Reputation Registry | Related ERC-8004 registry. Used for wiring checks; full reputation flows are out of scope for v1. |
| Vanity prefix | Testnet Identity Registry addresses start with `0x8004A818`. Mainnet starts with `0x8004A169`. Mixing them up fails silently unless checked. |
| MCP (Agent Launch) | Model Context Protocol as intended agent capability endpoint for registration gating. |
| MCP (Projects / AI) | CanHav MCP servers. The shared server at `www.canhav.com/mcp` reads design documents and deployed launches from an IDE or chat agent. Each project also has its own server, which its owner can allow to write drafts. Separate from Agent Launch MCP notes. |
| Registration file / URI | Metadata URI attached to an agent identity (URL or inline `data:` URI). |
| Agents indexer | Separate Ponder app for ERC-8004 events (not shared with the launchpad indexer). |
