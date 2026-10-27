# Product track

**Available now.** The fields below are the project record. Where each one lives on the project page is named in its heading; the page itself is described in [Studio](studio.md).

The Product track is a design document for what you are building. A product with no token is a legitimate published outcome.

The project page has seven sections, Overview, Build, Decisions, Business model and Brand (both Studio+), Deployments and Publish, in a left sidebar on wide screens and a row of tabs on phones. The sections never change with the product modules. Decisions holds what is being built, the chain, the template decisions, the contract architecture and the security declarations. Deployments holds the testnet contracts, the tokens and the mainnet record. Publish holds the rest of the public record and the readiness list. Build holds the build steps.

---

## What you are building (Decisions) and the public record (Publish)

### Asked

| Field | Notes |
|-------|-------|
| Project name | Required. Asked in the new project pop up, edited under Publish. |
| Chain | Under Decisions. Robinhood testnet or Arbitrum Sepolia. Where the project builds and tests, and the chain a token launched from it goes on. Projects from before the choice existed read as Robinhood testnet; since M139 a new project stores its chain, the new project pop up asks for it with nothing preselected, and the token name check, the factory link and the first hundred users wording follow the chain. Fixed once a token is linked to the project, by a launch or by a deployed linked token design. The resource pack, the environment block and the testnet notes follow it, and the Robinhood distribution acknowledgement is only asked of a Robinhood project. |
| Sector | Under Decisions (one can be picked in the new project pop up). Credit, Liquidity, Derivatives, Staking, RWA and Other. Each is a card with its name ("Credit sector application") and a sentence that starts "I am looking to". Pick every sentence that fits. All six are open since M68. Other may describe itself in a text field instead of picking a subsector. |
| Subsector | Asked for each chosen sector that has subsectors, grouped under the sector name when more than one does. Each subsector is a card with its name and a sentence. Credit offers Lending, Leveraged yield and Fixed income; Liquidity offers Vaults and Pools; Derivatives offers Perp DEX, Option vaults and Delta neutral; Staking offers Liquid staking, Restaking and Liquid restaking; RWA offers Tokenized securities, Private credit and Asset-backed tokens; Other offers Underwriting and Governance. All sixteen are open. A subsector whose every module relies on a protocol with no deployment on the project's testnet carries a note such as "Not on Robinhood testnet yet" and can still be picked. Pick one to three per sector; also offered in the new project pop up once a sector is chosen. Recommended since M130, not required, so a sector with none publishes as Not stated unless the team marks it not applicable. When a project is in more than one sector and a subsector shares product modules with one under another chosen sector, that one is ticked too and a line under the cards says why; it can be unticked again. |
| What are you building | Asked once a chosen sector has a subsector. A subsector that offers exactly one module (every subsector of Derivatives, Staking, RWA and Other) names it on its own, so the step shows a sentence such as "I am building a restaking service. I am looking to let already staked assets secure a second service for extra reward." instead of a second pick, and unticking the subsector drops the product. Where no contract template in the catalog runs on the project's mainnet yet, the sentence carries a note with a hover explanation saying the build steps still come and the team's agent can work through them over MCP. Subsectors that offer several modules keep the chips. Product modules are grouped by subsector. Lending offers Curated vault, Earn inside your app and Collateral-backed loans; Fixed income offers Fixed-rate yield on your asset, Fixed-rate savings inside your app, Borrow against fixed-rate positions and Leveraged fixed-yield loop; Leveraged yield offers Leveraged fixed-yield loop and Yield-token products; Vaults offers Curated vault and Earn inside your app (the same two modules reached through Lending), Liquidity allocator and Permissioned vault; Pools offers Basic AMM pool, Concentrated liquidity pool and Pool with custom hooks. The four sectors opened in M65 to M68 offer one module per subsector (Perpetuals venue, Option vault, Delta neutral yield, Liquid staking token, Restaking service, Liquid restaking token, Stock and fund tokens, Private credit pool, Reserve-backed token, Cover pool, Token governance), whose chain fit comes from the contract templates on their steps rather than a protocol family. Twenty-four modules in all. A module that spans subsectors is offered whenever one of them is chosen and appears once, and the picker shows subsector headings only when more than one subsector is chosen. Picking a module also ticks its subsectors under any other chosen sector. Pick as many as apply; the resource pack, build steps and review passes are the union across the chosen modules. Optional, but the research kit that follows is filtered by it. "About these modules" opens a short blurb per chosen module. The "what you could build" lines of each module (catalog examples and the team's own) are no longer edited on the page; they stay on the project and reach the team's agent through the resource pack and `set_ideas`. Where no catalog template runs on the project's mainnet the note's tooltip also says how many run on the other mainnet and offers the way forward, accept those and iterate for this chain or move the project to the other chain, and the resource pack carries the same plan under `templateGaps`. The testnet note: a module carries a note when a protocol family it relies on has no official or community deployment on the project's testnet (on Robinhood testnet the Pendle and Uniswap modules, with Morpho's community deployment counting; on Arbitrum Sepolia the Morpho and Pendle modules, with Uniswap deployed). It can still be picked and published. Its Build section names the missing protocol, and the team or its agent removes the steps that do not fit and adds its own. |
| Starting point | Asked with the module. From scratch; On top of an existing product (with an optional link or one line about what exists today). |
| Logo | Under Publish (and in the new project pop up). Shown on the studio, the public page and the Explore board. |
| What it does | Under Publish. One paragraph, at least eighty characters to publish; the new project pop up takes a short description that fills it. |
| Who you sell to | Under Publish. Optional. Businesses (B2B) or Individuals (B2C). The persona table below follows the choice. Switching keeps the other table's rows stored but hidden. |
| Who the user is | Optional. An ideal customer persona table with one to three personas. For a B2B audience each persona has Team size (a number or a range), Geography (city, country, or continent), Industry, Primary contact (a role or title) and Revenue range. For a B2C audience each persona has Age range (a number or a range), Geography, Crypto experience (new, some, active, professional), How they find you and What they hold. Starts with one persona; add up to three. |
| Who pays | Optional. The user pays, or someone else pays (with a line about who) |
| Why this chain specifically | Optional. Free text |
| Current stage | Idea; design doc; prototype; testnet contracts deployed; live elsewhere |

### Computed / warnings

None in this step.

Projects saved under a retired sector (underwriting and risk, oracles and data, agentic trading, stablecoin and payments, portfolio and vaults, DEX and market structure) render as Other with the old label kept as the free text.

---

## Ideal customers (Decisions, Studio+)

### Asked

One or two ideal customer profiles: name (a role), summary, wallets they use, channels, protocols they use, buying trigger, objection. Drafted by CanHav from the persona table plus the protocols in the same DefiLlama category on the project's chain (and, when a Dune query is configured, active wallet counts of similar protocols), or by the team's agent over `update_project` (`icp`, the list replaces the stored one). Published with the record. Who you sell to and the persona table now live in the same Customers section of Decisions.

## Brand (Decisions, Studio+)

### Asked

A palette of four hex colours (primary, secondary, accent, surface), a display and a body font from the list the studio offers, two to five tone words and a tagline. Picked from the logo's dominant colours (png or jpeg), drafted by CanHav or the team's agent (`update_project` with `brand`, merged over the stored kit), or filled by hand. Published with the record; the public page sets the palette and its link preview image carries it. The kit is one file, `brand.json`, on the project export, and a Brand section in AGENTS.md.

### Computed

Contrast of each colour against the surface (WCAG), shown as a line and flagged under 4.5 to 1. Three SVG banners from the kit, the X header (1500 by 500), the link card (1200 by 630) and the avatar (1024 by 1024).

## Competitors (Decisions, Studio+)

### Asked

One line on how the project differs (up to 300 characters), published with the record. Drafted by CanHav against the landscape, or by the team's agent (`get_competitors` for the landscape, then `update_project` with `competitors.differentiator`). The map's axes and pins are the team's own and stay on the draft.

### Computed

The landscape: DefiLlama protocols in the categories the project's subsectors map to (`content/competitors/llama-categories.ts`), on the project's chain when at least three are there, else any chain, from a monthly snapshot taken on the first of the month (Vercel cron) or inline once for a new category. Shown as a table and a positioning map (TVL on a log scale, age in months since listing).

## Business model (Decisions, Studio+)

### Asked

Nine free text blocks, the Business Model Canvas: customer segments, value proposition, channels, customer relationships, revenue streams, key resources, key activities, key partners, cost structure. Each up to 600 characters. Drafted by CanHav from the product, the personas and who pays, or by the team's agent over `update_project` (`canvas`, blocks merged over the stored ones), then edited. Published with the record and shown on the public page.

## Contract architecture and external dependencies (Decisions)

### Asked

| Field | Notes |
|-------|-------|
| What contracts exist | One row per contract, the name on top and why it exists under it (2 to 80 and 10 to 300 characters, up to thirty rows). "None yet" is a checkbox, not typed text. An answer written before rows existed stays readable above the list until you or your agent split it into rows (`update_project` `architecture.contracts` with `contractsLegacy` null). A row whose name matches a recorded testnet contract shows its address |
| External dependencies | Protocols your contracts call (for example Uniswap, Morpho, Chainlink) |
| Oracles | Free text |
| Upgradeability | Immutable; upgradeable proxy; partially upgradeable; undecided |

### Computed / warnings

None.

---

## Admin functions (Decisions)

### Asked

| Field | Notes |
|-------|-------|
| Admin functions and why they exist | One row per privileged function, the name on top and why it exists under it, with the contract it lives on (picked from the contracts rows) and who can call it ("Team Safe 2 of 3", "Timelock, 1 day"). "None, the contracts are immutable and have no admin functions" is a checkbox and publishes as a strength. An answer written before rows existed stays readable above the list until split (`update_project` `architecture.adminFunctions` with `adminFunctionsLegacy` null). The security review pass on keys reads this list. |

### Computed / warnings

None.

---

## Worst-case bug impact and security status declarations (Decisions)

### Asked

| Field | Notes |
|-------|-------|
| Worst-case bug impact | Lose user funds; lock funds; misprice; nothing serious |

Security status declarations (same four statuses as elsewhere: already in place; handled by legal/ops; planned before mainnet; not yet):

| Declaration | Covers |
|-------------|--------|
| Audit | External review status |
| Bug bounty | Program status |
| Monitoring | Ops monitoring |
| Incident response | IR readiness |
| Key custody | How keys are held |

Copy pressure scales with the worst-case answer. That is framing only, not validation.

On the public page, “not yet” on high blast-radius answers reads as a live risk the team chose to publish.

**Project files.** Decisions ends with the team's own files by reference, a title, a link or a path on the team's machine, a note and an optional evidence handle. Nothing is uploaded and nothing here is published; the list reaches the agent through the project's server and the draft exports.

---

## Reality (Publish and Deployments)

Before publish, the Publish section requires an explicit acknowledgement from a project on Robinhood testnet (an Arbitrum Sepolia project is not asked):

> Robinhood Chain does not provide distribution to Robinhood brokerage customers. Deploying here puts your app in front of nobody by default. CanHav is an independent project with no affiliation with Robinhood Markets, Inc. Listing here is not a channel to its users either.

### Asked

| Field | Notes |
|-------|-------|
| Myth acknowledgement | Required checkbox, under Publish |
| Where will your first hundred users come from? | Free text, under Publish |

### Computed

Where each protocol family the chosen modules rely on runs today (the testnet and mainnet status, the note, the source and the recommended path) opens from the sidebar's Resources group as **Where protocols run**. An agent reads the same rows in `environment` on `get_resource_pack`, and the exports carry them.

Optional verify signals attach for public credibility checks scoped to the **project**, not to a linked token: the GitHub repo and the website under Publish; the testnet contract addresses (label and address rows with explorer links), the address book and the team wallet under Deployments.

**Mainnet and Pons pairing (M70).** Under Deployments, a project records its mainnet deployment beside the testnet launch. The chain is fixed to the mainnet the project's chain stands in for (Robinhood Chain 4663 or Arbitrum One 42161). Contracts are label and address rows, linked to that mainnet's explorer on the public page, the Token launch panel and in the exports. The companion contract is chosen among the templates accepted on the Build step that carry a Pons fit line, so the Pons pairing names the template the companion is built from. On a Robinhood project the Pons launch's token address and creator fee recipient are recorded too; an Arbitrum project sees a note instead, since Pons runs on Robinhood Chain mainnet only. The record is optional and never injected (a project without one hashes as before), published with the record, and reachable to agents through `update_project` (`mainnet`), `get_project_status` and the `project` block of `get_launch`. Each signal is omitted silently if it fails to load. See [Public pages](public-pages.md).

---

## Build steps (Build)

The Build section lists every step of every chosen module as one list under four milestones, Design, Testnet, Review and Launch. The editor area a catalog step informs decides its milestone, and `get_build_steps` reports it as `milestone`. A Now view shows the next three open steps; All steps shows the milestones in full, and the sidebar opens one milestone at a time. Each step carries a status (Todo, Done, Partial, Not applicable with a reason that leaves the count), the modules it belongs to, a Read menu of the resources that help, an evidence line, the first contract template that fits it with Using and Not using and the rest behind a fold, and Remove. A step that is the same work across several chosen modules (running the review passes, planning the fork and staging, choosing markets, assigning roles, the dead deposit, the scenario walk, the testnet deployment) is listed once with every module's label; ticking it ticks the step for every module, and the studio row, the public page, the readiness list, the exports and `get_build_steps` count it once.

Review passes sit under Review as rows with a verdict each (Pass, Fail, Not applicable). Launch holds three rows derived from the record, testnet contracts recorded, token linked and project published, each opening the section that settles it. What this product includes folds out per module: a ticked feature adds the steps it gates and ranks the templates it suggests first. These steps never block publishing. The list is a starting point: removed catalog steps sit under Removed steps where they can be restored with their tick, and a team can add its own steps under a module with a title and an optional line on what done looks like, up to forty per project, ticked and counted like the rest and marked Your step. An agent connected to the project's MCP server can tick, add, remove and restore steps, record evidence and mark steps not applicable through the same proposal flow as every other change.

---

## Recommended fields and waivers

Since M130 publishing needs five things: the name, at least one sector, what it does (eighty characters), the current stage and, on a Robinhood testnet project, the distribution acknowledgement. Everything else that used to block is recommended: the subsector, the Other sector description, the contracts, external dependencies, oracles, admin functions and upgradeability, the worst case, the five security declarations and where the first hundred users come from. A recommended field the team leaves empty publishes as "Not stated" on the public page, in the exports and in AGENTS.md. Under each one a "Does not apply" link takes a reason of 3 to 200 characters; the field then folds to "Not applicable, reason", which publishes as plain text, and the team can edit the reason or bring the field back. A stated value always wins over a waiver. The agent does the same over MCP with `waived` on `update_project` (a key sent as `null` clears a waiver); `check_project` lists the recommended fields still open under `recommendedOpen`, `get_project_status` carries them under `project.openFields`, and AGENTS.md ends its architecture section with an Open fields list naming the `update_project` field that states each.

## Readiness and publish (Publish)

The Publish section ends with a readiness list: the sector, subsector, modules, starting point, build progress, stage and personas as they stand, then one row per recommended field (its value, "Not stated" or "Not applicable, reason"), a line counting the recommended fields still open, and either "Everything checks out" or the first blocking item with a button to the section that holds it. Decisions carries a dot in the sidebar while no sector is chosen, Publish while the name, what it does, the stage or the acknowledgement is missing, and the Publish button's tooltip names the first one. Publishing snapshots the document and assigns a public slug under `/p/...`. Linking to a token design is optional. See [The two ideation tracks](two-tracks.md).

---

## Related

- [Token track](token-track.md)
- [The two ideation tracks](two-tracks.md)
- [The three answer types](three-answer-types.md)
- [Enforced versus stated](enforced-vs-stated.md)
- [Public pages](public-pages.md)
