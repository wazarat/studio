# Litepaper

**Available now.** Version 0.1, October 1, 2026. A testnet research preview by Wazarat Ali Hussain, CanHav Research.

{% file src="../.gitbook/assets/CanHav_Litepaper_v0.1.pdf" %}
Download the CanHav Litepaper v0.1 (PDF, 14 pages)
{% endfile %}

The full text is below for reading in the browser. The PDF and this page say the same thing; if they ever differ, the contracts and [Contract addresses](../token-launch/contract-addresses.md) are the source of truth.

---

## Abstract

CanHav is a launchpad and build studio for onchain teams. It takes a team from the first idea for a product to a live, tradable token with a public record that anyone can check.

Most launchpads stop at the token. They make it easy to create one and say nothing about what is being built, whether the plan is real, or what the team promised. CanHav treats the token as one step in a longer path. Teams plan their product in the Studio with guided research, launch their token on a bonding curve that graduates into locked liquidity, and back their claims with onchain commitments, milestone lockups and progress updates. Every part of that path is also open to AI coding agents through the Model Context Protocol (MCP), so the tools a team already builds with can read the plan, the research and the live market.

CanHav runs today on two testnets, Robinhood Chain Testnet and Arbitrum Sepolia. Everything described here is free to use and has no real value. Nothing in this document is an offer, a recommendation or investment advice.

---

## 1. The problem

Teams that want to build onchain financial products face three gaps.

**Research is scattered.** A team building a lending vault or a fixed rate product has to find the right protocol docs, standards, risk methods and security tooling on its own, then work out which of those protocols actually exist on the chain it plans to use. Most of that knowledge lives in threads, PDFs and private notes.

**Launches carry no trail.** On a typical launchpad a token appears with a name, a ticker and a picture. Plans, lockups and sale terms live in a post that can be edited or deleted. Buyers have no way to check what was said at launch or whether the team followed through.

**Agents are left out.** Builders now write much of their code with AI agents in their IDE. Those agents cannot see the product plan, the research a team gathered, or the state of the token, so every session starts from zero.

---

## 2. What CanHav is

CanHav has three connected parts.

| Part | What it does |
|------|--------------|
| **Studio** | A team designs its product and, if it wants one, its token. Guided research, build steps and review passes for the chosen product module. |
| **Token Launch** | One transaction creates a token on a bonding curve. At a set threshold it graduates into a liquidity pool that can never be withdrawn. Optional rails add commitments, milestone lockups, fixed price sales and progress updates. |
| **Agents** | A shared MCP server reads every launch and published design. Each project also gets its own MCP server, bound to that one project, that an agent can read and, with the owner's permission, write to. |

The parts work together but never gate each other. A product with no token is a valid outcome. A token design that is never deployed is a valid outcome. A token can be launched in a couple of clicks with no project at all and linked to one later.

---

## 3. The Studio

The Studio is where a team works out what it is building before it writes code or launches anything.

### 3.1 Projects in plain sentences

A project starts with a few plain sentences about the product, who it serves and whether it is for businesses or consumers. The team then picks one or more sectors, the subsectors inside them, and the product modules it is building.

| Sector | Subsectors | Product modules |
|--------|------------|----------------|
| Credit | Lending, Fixed income, Leveraged yield | Eight modules, including a curated lending vault, earn inside an existing app, collateral-backed loans, fixed rate yield, fixed rate savings, borrowing against fixed rate positions, leveraged fixed yield loops and yield token products |
| Liquidity | Vaults, Pools | Five modules, a liquidity allocator, a permissioned vault, a basic AMM pool, a concentrated liquidity pool and a pool with custom hooks |

More sectors are listed as coming soon. Each module comes with a short teaching card and worked examples, written in CanHav's own words.

### 3.2 The research kit

Choosing a module opens a research kit built for it.

- **Resource pack.** A reading list drawn from a catalog of several hundred curated sources across Morpho, Pendle, Uniswap, Robinhood Chain and shared standards, grouped Core, Recommended and Deep dive, each with a line on why it matters and a flag where a source is unofficial, mainnet only or something a team must deploy itself. Every link was checked before it was added.
- **Build steps.** An ordered list of ten or so steps for the module, each tied to the part of the editor it informs. Progress shows on the studio row and the public page, for example "Build 4 of 11". Teams can add their own steps and remove ones that do not apply.
- **Pre-launch review passes.** The security checks that matter for the module, each with what counts as evidence and a pass, fail or not applicable verdict saved with the project.
- **Where it runs.** For each protocol the module relies on, whether the chosen testnet and its mainnet have an official deployment, a community one, a manifest only or nothing, with the recommended path from testnet with mocks to a local fork to capped mainnet staging. A missing protocol produces a note, never a block.
- **Kit files.** Templates a team can take into its repository, such as an architecture document, a risk framework, a role model, invariants, rate transparency and per-asset research.

### 3.3 Token design

A team can also design its token before launching it. The token track asks for supply, allocation and vesting, computes float and unlock calendars, and raises warnings where a design looks risky. It keeps a clear line between what the CanHav contracts **enforce onchain** and what the team only **states**, so readers are never asked to treat a promise as a guarantee.

### 3.4 Publishing and export

Projects and token designs can be published as public pages and exported as Markdown, including an `AGENTS.md` file written for coding agents and a `RESOURCES.md` file with the full research kit.

---

## 4. Token Launch

### 4.1 Lifecycle

1. **Create.** One transaction deploys the token, mints the full supply to the launcher and opens the bonding curve. The creator's optional first buy happens inside the same transaction.
2. **Trade the curve.** Anyone can buy and sell against the curve. There is no trade fee on the curve.
3. **Graduate.** The buy that brings the ETH raised to the threshold graduates the curve in the same transaction. Nobody has to trigger it.
4. **Trade the pool.** Trading continues in a CanHav AMM pool seeded with the raised ETH and the reserved supply. Its liquidity is locked forever.

### 4.2 The bonding curve

The curve is a constant product curve with virtual reserves, the shape most large launchpads use. Every number is fixed when the launcher is deployed and can be read on the contract.

| Parameter | Value on both testnets |
|-----------|------------------------|
| Default supply | 1,000,000,000 tokens, fixed at creation |
| Sold on the curve | 80% of supply |
| Reserved for the pool | 20% of supply |
| Graduation threshold | 0.1 ETH raised |
| Snipe tax | 20% of every buy in the first 60 seconds |
| Developer buy cap | 0.005 ETH, exempt from the snipe tax |
| Trade fee on the curve | None |

With a 1 billion supply a token opens at about 3.1e-11 ETH and graduates at 5e-10 ETH, a 16x move across the curve. The curve's end price is set to equal the pool's opening price, so graduation causes no price jump.

### 4.3 Fair start

Bots that buy in the first seconds of a launch are the most common complaint about bonding curve launchpads. CanHav answers this in the contract. For the first 60 seconds every buy pays a 20% tax. The tax is not a fee for CanHav. It is held aside and added to the pool at graduation, so early snipers end up funding locked liquidity for every holder. The window is measured in seconds rather than blocks, because block numbers on Arbitrum chains follow the parent chain.

The creator's own first buy, made inside the launch transaction, is exempt because it is provably first. It is capped at 0.005 ETH so a creator can never graduate their own curve.

### 4.4 Graduation and locked liquidity

At graduation the launcher creates a pool on LaunchAMM, adds the raised ETH, the snipe tax pot and the reserved 20% of supply, and keeps the liquidity shares. Pool shares cannot be transferred or burned, and the launcher has no code path to remove liquidity. The liquidity is therefore locked forever. The 0.30% LP fee on every swap compounds into those locked reserves.

Locked liquidity means there is always something to trade against. It does not mean the price cannot fall.

### 4.5 Credibility rails

A launch can carry a public trail beyond the token itself. These rails are optional and admin-less, with no owner and no operator key.

| Rail | What it does |
|------|--------------|
| **Description hash** | Every launch records a hash of its description, so the token page shows the description only when it matches what was committed at launch. |
| **Commitment** | A launcher can commit a plan with dated milestones, or a published token design. The hash goes onchain at launch, and anyone can re-hash the document to check it was not changed. |
| **Milestone escrow** | The creator can lock tokens until milestone dates in the committed plan. Nobody, including CanHav, can rewrite the schedule. |
| **Allocation sales** | Fixed price sales with zero platform cut, whose proceeds the team can claim only in milestone-dated tranches. |
| **Progress updates** | The creator posts updates against milestones. The text lives offchain and its hash is anchored onchain, so a page only shows updates that match. |

A commitment proves what was said at launch. It does not force a team to deliver. CanHav is explicit about this difference everywhere it shows a commitment.

### 4.6 What a CanHav token cannot do

Every token is a clone of one verified implementation.

- It has no mint function after creation, so supply can never grow.
- It has no owner, no pause, no freeze and no blacklist.
- It cannot be upgraded.
- CanHav takes no share of supply. This is enforced by the absence of a mint path, not by a policy.

---

## 5. Agents and MCP

CanHav is built so that the AI agents a team already uses can work with it directly.

**The shared server** at `https://www.canhav.com/mcp` exposes every launch and every published design. Agents can list launches, read a token's curve, pool, sales and commitment, check whether a committed document still matches its hash, and read governance state on either chain. Read tools work without an account. Tools for a person's own projects and launches use a standard OAuth sign-in.

**Project servers** are bound to a single project. An agent connected to one reads that project's plan, research pack, build steps, review passes and linked token without being told which project it is in. With the owner's permission, an agent can also draft changes. The owner picks per project whether agent edits arrive as proposals to approve one by one or apply directly. Agents never publish.

**One paste prompt.** The token page, the launch success screen and the studio each offer a prompt to paste into Claude Code, Cursor or any MCP client. The prompt connects the right servers, reads the launch or project, and reports back in plain words.

The result is that a team's plan, its research and its live market sit in the same place as its code.

---

## 6. Economics

| Item | Value |
|------|-------|
| Share of token supply taken by CanHav | 0% |
| Launch fee | 0.0002 ETH per launch, hard capped in the contract at 0.05 ETH |
| Trade fee on the curve | None |
| LP fee in pools | 0.30%, paid to liquidity providers |
| Protocol fee in graduated pools | None, graduated pools opt out |
| Protocol fee in pools a creator opens by hand | Optional, 20 bps by default, hard capped at 50 bps, split 70% to the project and 30% to the platform in the contract |
| Platform cut of allocation sales | None |

Platform fees go to a FeeSplitter contract, never to a personal wallet. A pool's protocol fee is fixed when the pool is created, so a later change to the default never rewrites an existing pool. There is no creator trading fee. Everything described in this paper is free; Studio+, an optional subscription for teams ($39.99 a month, or $29.99 a month billed yearly, three seats included), adds planning, brand and operations features to the Studio and never gates a launch.

---

## 7. Governance and trust

**Timelocked admin.** Each chain has its own TimelockController that owns the launcher, the factory, the AMM's fee setting and the FeeSplitter's payees. Any admin change, such as the launch fee, waits out a public delay before it can run. The delay is 300 seconds on testnet. Anything closer to production should use 24 hours or more. Pending changes are visible on the site's governance page.

**Narrow pause.** A pauser can stop new launches and new curve buys at once, as an emergency control. Sells can never be paused, and existing tokens cannot be paused at all. Unpausing waits on the timelock.

**Admin-less rails.** The escrow, sale and update contracts have no owner. There is no attester who can mark a milestone as met or release funds early.

**Indexed, not trusted.** The site and the agent tools read indexed chain events and re-check every stored document against its onchain hash. If the site or indexer goes down, the tokens and pools keep working onchain, and the hashes still let anyone verify a document.

**Verified source.** The contracts are open source with a Foundry test suite. On Robinhood Chain Testnet all contracts are source verified. On Arbitrum Sepolia the launcher and factory are verified and the rest are the same code. No third-party audit has been published, so the contracts should be treated as unaudited.

---

## 8. Two chains

CanHav launches on two testnets with identical contracts and identical parameters, each with its own timelock and its own indexer.

- **Robinhood Chain Testnet (chain 46630).** An Arbitrum Orbit chain built for tokenised real world assets and financial products. It is the home of CanHav's research catalog for credit and liquidity products.
- **Arbitrum Sepolia (chain 421614).** The main Arbitrum testnet, with the widest set of protocols and tooling.

A project picks its chain and its token lives on that chain. Every page, reader and agent tool follows the token's chain automatically. Some contract addresses are the same string on both chains but point to different contracts, so an address should always be read together with its chain.

CanHav has no affiliation with Robinhood. Robinhood Chain does not distribute apps or tokens to Robinhood brokerage customers.

---

## 9. Risks and limits

- **Testnet only.** Testnet ETH and the tokens launched here have no value, and a testnet can be reset by its operator.
- **Tokens can go to zero.** Sellers can take a price down as fast as buyers took it up.
- **Graduation is not a quality signal.** It means 0.1 ETH was raised on the curve and nothing more.
- **Names are not unique.** Anyone can launch any name and ticker. Check the address and chain.
- **Commitments are statements.** Only the supply is enforced by the token contract.
- **No audit is on record.** The contracts are tested but unaudited.
- **Offchain parts can fail.** The site, indexer and stored documents can be unavailable, though the onchain state is unaffected.

---

## 10. Roadmap

CanHav moves forward only once each loop is proven on testnet.

**Available now**
- Token Launch with bonding curve and locked liquidity on Robinhood Chain Testnet and Arbitrum Sepolia
- Credibility rails, commitments, milestone escrow, allocation sales and progress updates
- The Studio with Credit and Liquidity sectors, thirteen product modules and their research kits
- Shared and per-project MCP servers, agent edits with owner approval, Markdown export

**Next**
- Holder views on the token page
- More sectors in the Studio
- Source verification of the remaining Arbitrum Sepolia contracts and a third-party audit

**Later, and only after the testnet loops are proven**
- Mainnet launches, with a production length timelock delay and fee sharing designed for mainnet
- A Foundry project generator built from a design
- An agent identity track based on ERC-8004

Nothing on this roadmap is a promise or a date.

---

## Appendix A. Contract addresses

Always read an address together with its chain.

### Robinhood Chain Testnet (46630)

Explorer https://explorer.testnet.chain.robinhood.com

| Contract | Address |
|----------|---------|
| CurveLauncher | `0xb2e1F2df7775d17CE70c8CE7586c7bb01bD10981` |
| TokenFactory v4 | `0x30Db3A828F65B92434c6aDB27AEeD01850277b08` |
| TimelockController | `0x080cCDC07e2a0a5D11e9dDaA873ea68F540109ae` |
| LaunchAMM | `0xDd070b1f8e000D27491A3d38543ef0D72C758Df4` |
| FeeSplitter | `0x9FDFae007b65d4c8F3CCA6AC242E3f141eC9DA18` |
| MilestoneEscrow | `0x90C71DBA8A61Da14CA699f72D311e404094Cf192` |
| AllocationSale | `0x869cE70ff8174802d98D26835ce4040754Ad284A` |
| JourneyUpdates | `0x31358209375591b1285EaA437c2c9f189c48D073` |
| LaunchToken implementation | `0x3E8c9be8BB486abEc132B0d1C35266b2336b129B` |

### Arbitrum Sepolia (421614)

Explorer https://arbitrum-sepolia.blockscout.com

| Contract | Address |
|----------|---------|
| CurveLauncher | `0x6Dde90B06b920565ccBA93D8ad7d5AfE5846426f` |
| TokenFactory | `0xdC3521DDEFfca6825771da6c23679A7BA1E82475` |
| TimelockController | `0xeD66C31FFAC1C5dCf4f327536a7540B22DF2B5E1` |
| LaunchAMM | `0x4EA372acAb7be21113f474CEd2B7b317019afeD3` |
| FeeSplitter | `0x37dC58e2098b61249E12e0674D0C137EDf5248B4` |
| MilestoneEscrow | `0x3F7AcbFE98c5Ac72259F7e838886c310f3E0D8ce` |
| AllocationSale | `0x10F33eE0f6a72D7Cc1f41196B4EF80B28C909Bc0` |
| JourneyUpdates | `0x97d41F630025f83AdF72f00BaD8dC9B5e01eBEFC` |
| LaunchToken implementation | `0x3E8c9be8BB486abEc132B0d1C35266b2336b129B` |
| LaunchVestingWallet implementation | `0x1dAaa8294806d216Df36dc07B3803ED26584c909` |

---

## Appendix B. Glossary

| Term | Meaning |
|------|---------|
| Bonding curve | A contract that sells a token at a price set by a formula, rising as more is bought |
| Graduation | The moment a curve reaches its ETH threshold and moves its liquidity into a pool |
| Locked liquidity | Pool liquidity that no one, including CanHav and the creator, can withdraw |
| Snipe tax | A tax on buys in the first 60 seconds, paid into the graduation pool |
| Commitment | A hash of a plan or design recorded onchain at launch |
| Timelock | A contract that forces a public waiting period before an admin change can run |
| Product module | The specific kind of product a team is building inside a sector, such as a curated vault |
| MCP | Model Context Protocol, the standard AI agents use to connect to tools and data |

---

*This litepaper describes testnet software in a research preview. It is not a legal whitepaper, not an offering of any token, and not financial advice. Details may change. Numbers and addresses should always be confirmed on the contracts themselves.*

## Related reading

- [Welcome to CanHav](welcome-to-canhav.md)
- [What CanHav is](what-canhav-is.md)
- [Token Launch overview](../token-launch/overview.md)
- [Contract addresses](../token-launch/contract-addresses.md)
- [Risks](../token-launch/risks.md)
