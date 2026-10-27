# Studio

**Available now.** Requires a CanHav [account](../accounts/clerk-accounts.md).

The studio (`/studio`) is where a signed-in account sees everything it owns: its launches, its projects and its token designs. The **Log in or sign up** button in the navigation opens it. Once you are signed in the button reads **Studio**.

On every studio page the navigation carries a breadcrumb after the logo, **Studio / the project or token design you have open**. The name opens a switcher that lists your projects and token designs with the current one marked, plus **New project** and **Studio home**. On the studio home the breadcrumb reads **Studio** alone and the switcher sits on that word. The account menu (wallets, sign out) sits at the right. On a phone the breadcrumb shows only the name.

A command menu opens with Cmd K (Ctrl K elsewhere) or the key hint in the studio header. It creates a project or a token design, goes to a studio page, opens any of your records, and on a project page jumps to a section.

## The studio page

| Section | What it lists |
|---------|---------------|
| Start a project | One card that opens the new project pop up. The studio launches projects; a token design is started from a project (the pop up's last step, or the Overview's link panel) rather than from the home. |
| Launches | A collapsed line, "You have launched N tokens", counting only this account's launches: the ones made while signed in and the ones its verified wallets created on chain. Open it for the three newest, each row opening the token page. With more than three a **View all launches** button opens the full list in a new tab. |
| In progress | Your project drafts and published projects that have not launched, each with its linked token design, its build progress and, when an agent is connected, whether it is working, waiting on you or has proposals for you. |

A project whose token has launched leaves the list and shows under Launches, with a **Launched** chip wherever it appears. Token designs are reached from their project, the switcher and the command menu. Launched records cannot be deleted; the API answers with the reason.

### Starting a project

The new project pop up opens from the **Studio** card, from **New project** in the command menu and in the switcher, and at `/studio/new` as a deep link. It stays on the page you are on. Five short steps; the name and the chain are required, the rest can wait:

| Step | Asks |
|------|------|
| Name | The project name, three characters or more. Enter moves on. |
| Sector | One of the six sectors as a card, or **I have not decided yet**. Optional. |
| Chain | Robinhood testnet (the default) or Arbitrum Sepolia, and a short description of the project. Optional. |
| Logo and token | A logo, and whether you want a native token: **Yes**, **No** or **Not sure**. Yes creates a token design named after the project and links it. Optional. |

Every step says the same thing at the bottom: everything here can be changed later while you ideate and build. **Create project** makes the project and opens it. Nothing is stored until then, so closing the pop up leaves nothing behind.

### The launches page

`/studio/launches` lists every launch of the account, then every project still in progress, with a chain filter (all chains, Robinhood testnet, Arbitrum Sepolia) kept in the URL. It is reached from the studio home and is not linked from the navigation, which since M147 carries only Docs, the theme toggle and the account button.

### A launch row

| Control | What it does |
|---------|--------------|
| The name | Opens [the token page](../token-launch/token-page.md) |
| Link a project, or Change | Links the launch to one of your projects on the same chain, starts a new project for the token, or unlinks. See [Projects and launches](../token-launch/projects-and-launches.md) |
| Agent prompt | Opens a prompt to paste into an AI IDE so an agent can read the launch over MCP |

A launch appears here when it was made while you were signed in. A launch that reached you only through a token design has no project control of its own; it follows the design's link.

## The project page

A project opens at `/studio/project/<id>`. On a wide screen a sidebar on the left lists the project's eight sections, three of them with Studio+, the navigation's logo and breadcrumb line up above the project name in it, and the content fills the rest. On a phone the sidebar folds into a row of tabs. The sections never change with what the project builds; product modules are labels and filters inside Build. The section in view is kept in the URL (`?tab=build`), so a link lands on the right one and a reload keeps it.

| Section | Holds |
|---------|-------|
| Overview | What the project is in one strip, the agent, how to connect one, the resource pack, the linked token design and the token launch panel |
| Build | Every build step under four milestones, Design, Testnet, Review and Launch |
| Decisions | What you are building, the chain, the contract templates you decided on, the contract architecture, the security declarations and your project files |
| Business model | With Studio+, the Business Model Canvas, the ideal customer profiles and the competitor landscape |
| Brand | With Studio+, the brand kit |
| Viability | With Studio+, whether the idea can work on its chain, the assets it depends on and the dependency check, what is live on the chain, the unit economics and the experiments |
| Deployments | Testnet contracts, the tokens linked to the project, the mainnet record |
| Publish | The rest of the public record, the readiness list and the hand off to your agent |

The sidebar also lists **Agent changes** (Overview, scrolled to the agent) and, once published, **Public page**. Under them a **Resources** group lists what the project gets from CanHav, each opening a drawer: the **Resource pack** (tick and untick what the agent is given), the **Contract templates** that fit the chosen modules (Accept or Reject each) and **Where protocols run** (the testnet and mainnet status of each protocol the modules rely on, with the recommended path). Reading them is optional; the agent receives every section over MCP and picks what it needs. Decisions and Publish carry a dot while they hold fields the public record still needs. The fields themselves are described in [Product track](product-track.md).

### The header

Across from the project's name, on every section:

| Control | What it does |
|---------|--------------|
| Agent line | Connect agent, Agent connected, Agent working or Waiting on you, from the connected agent's last report |
| Checks (Build, Review) | Every review pass has an evidence field for any account. Studio+ teams add the checks workflow so Slither or Aderyn and Sourcify post their runs, shown as a line on the Static analysis pass and under the testnet contracts, see [Automated checks](../ai/checks.md) |
| GitHub sync (Deployments) | Studio+. A workflow in the repository posts deployed addresses from Foundry broadcast files and ticks steps named in commits, see [GitHub sync](../ai/github-sync.md); Deployments shows the last sync as a line |
| Project keys (Deployments) | Studio+. Keys with read or write scope that stand in for a browser sign in on the project's MCP server and its draft export, for cloud agents and CI. Shown once, revocable, see [Markdown export and MCP](../ai/export-and-mcp.md#project-keys) |
| History | The version history pop up. Every save of the draft, by you, a teammate or your agent, newest first with what changed, and Restore on each (Studio+). The published versions are listed for everyone |
| Move to team | On a personal project, for the account that made it, while a Studio+ team is active. Moves the project, its linked design and its launches to the team, see [Accounts](../accounts/clerk-accounts.md) |
| Link a token (Token launch once one is linked) | Jumps to the Token launch panel on Overview |
| Name check | Under the project name on Publish, in the new project pop up and on the launch form, a plain line when a coin of that name or ticker is listed on CoinGecko or DexScreener. A warning only, nothing blocks |
| Agent prompt | Opens the guide for connecting an agent to this project |
| Published | The public link, once published. An unpublished record carries no chip; it is a draft |
| Publish, Republish, Unpublish | Publishes a snapshot to `/p/<slug>`. While the record still has open fields, Publish opens a pop up naming each one with a button into the section that holds it |

Edits save on their own a moment after you stop typing, and the save state (Saving, Saved, or not saved with a retry) shows above the section you are editing. If an agent writes to the draft while the page is open and nothing here is unsaved, the page takes the new draft; with unsaved typing it pauses saving and asks for a reload instead.

### Overview

| Block | What it shows |
|-------|---------------|
| The strip | The short description, the product modules, the chain, the stage, the build progress and the deployer key's state, No deployer key, Deployer not funded, or Deployer funded on the chains it holds ETH on. The deployer chip opens Deployments. The **Build x of y** chip opens Build progress, done of total per milestone with a bar, an Open button into each, the open steps and a prompt that hands them to your agent. The **Summary** button opens what your agent says is built and being built |
| Summary | Two short lists written by the agent over MCP (`set_summary`) and kept current as work lands, Built and Being built, with the date. Tick the points you do not agree with, say what you want instead, and copy the prompt into your IDE; the agent checks each point against the repository and fixes the code or the summary. Without a summary the pop up offers the prompt that asks for one. The summary stays on the draft and is never published |
| Team update | With Studio+, the team's own post for the public page, named apart from the wallet signed milestone update. **How often** picks the cadence, daily, every other day, weekly or only when asked; your connected agent reads it and whether an update is due on `get_project_status` and writes one with `set_weekly_update` or adds to it a line at a time with `add_weekly_update_lines`, or the Draft button asks it, or CanHav drafts it from the period's agent sessions and changes, check runs, the GitHub sync line and the summary; edit the body, up to five highlights (each with an optional milestone, module and build step) and up to five focuses for the next period, **Save draft**, then **Publish to the page**. One row per period, earlier published ones listed under it. Distinct from the wallet signed milestone updates anchored on chain |
| Resource pack | One line with how many core resources your agent holds, and **Read** opens the same drawer as the sidebar's Resource pack, where you can tick and untick what the agent is given. The pack itself lives with the agent, through `get_resource_pack`, `RESOURCES.md` and `AGENTS.md` |
| Agent session | What the connected agent says it is doing: its state, a title, a message, its plan as a checklist and when it last reported |
| How agents write | Propose changes (the default), Write directly, or Off |
| Waiting for you | Proposals the agent made, each with the current value beside the agent's, with **Accept all** and **Reject all**. A proposal that builds on earlier ones is accepted after them |
| Earlier changes | The history of what agents proposed, wrote, and what you decided |
| Read this project from your agent | The add command and the prompt to paste |
| Linked token design | Link, create and link, or unlink a token design |
| Token launch | The launches linked to this project, each with an Agent prompt and Unlink, a picker for your unlinked launches on the same chain, a field to link one by address, short form or page link, and a link to launch a token from the project |

### Build

Build lists every step of every chosen module as one list under four milestones. **Now** shows the next three open steps; **All steps** shows the milestones in full, and the sidebar's Design, Testnet, Review and Launch items open one milestone at a time (`?tab=build&milestone=testnet`). With more than one module a module filter narrows the list. The milestone row sits right above the milestone sections it filters, under the "What this product includes" folds. Every open step carries **Send to agent**, a small menu with **Queue it for your agent** (when an agent has worked on the project and writes are on, it queues the step on the project; your agent reads it first on `get_project_status` with the step's title, detail, resources and templates, works it, adds evidence and ticks it, which clears the request; the row reads "Queued for your agent since 4:30 PM" with Cancel, and "Done by your agent, 4:52 PM" afterwards) and **Copy the prompt** (a prompt for that one step to paste into your IDE). Each milestone heading has the same for all its open steps. At most ten steps can be queued at once.

| On a step | What it does |
|-----------|--------------|
| Status | Todo, Done, Partial (a step shared between modules ticked for some of them) or Not applicable. Done ticks the step for every module that carries it. Not applicable asks for a reason, leaves the step out of the count and shows it struck through; Applies again brings it back |
| Module labels | Which chosen modules the step belongs to |
| Read | The two or three resources that help with this step |
| Evidence | One line, a file, a test name, an address or a commit, stored with the step and shown in the exports |
| Template | The first contract template that fits the step, with **Using** and **Not using**. The rest sit behind **+N more** with their full cards. A decision travels to every step that lists the template and to Decisions |
| Remove | Takes the step out of the list. Removed catalog steps sit under **Removed steps** and can be restored with their tick |

Under Review the pre-launch review passes sit as rows with a verdict each, Pass, Fail or Not applicable. Under Launch four rows are derived from the record, the deployer key funded on the project's chain, testnet contracts recorded, token linked and project published, each opening the section that settles it. **What this product includes** folds out per module: a ticked feature adds the steps it gates and ranks the templates it suggests first. **Add a step** adds your own under a module, ticked and counted like the rest, up to forty per project.

With Studio+, the Testnet milestone ends with the **Tester kit**: invite links testers open without an account (the faucet, your recorded testnet contracts, the steps you list one per line, a rating and a note per step), each with a name, a cap on replies and an expiry, revocable; the feedback lands under the kit and on `get_tester_feedback`. CanHav holds no keys and pays no gas.

Build steps never block publishing. An agent connected to the project's server ticks, adds, removes and restores them through the same proposal flow as every other change, and reads the milestone of each step as `milestone` on `get_build_steps`.

### Decisions

The choices with a reason behind them, each editable in place: what you are building (sectors, subsectors, product modules, the starting point), the chain (fixed once a token is linked to the project), the contract templates decided on Build with the agent's note where an agent decided one, the contracts, external dependencies, oracles, admin functions and upgradeability, the worst case a bug could cause and the five security declarations, and your project files (a spec, a repository path, a document link, never published, visible to your agent).

A **Customers** section holds who you sell to and the persona table (moved here from Publish). The sidebar lists the Decisions sections and scrolls to each.

### Business model

Studio+. Three sections on one tab, each a teaser with the upgrade link on a free account. **Business Model Canvas**, the nine blocks drafted from the record (one Draft control, a Redraft link on each block, each opening the menu of ways, your agent, CanHav or the prompt to copy, with a short brief of questions the first time) and edited in place. **Ideal customers**, one or two profiles with the wallets, channels and protocols they use, drafted from the personas and the protocols in your subsector on DefiLlama. **Competitors**, the protocols in your subsector on your chain from DefiLlama (refreshed monthly, with TVL, chains and age), a positioning map you sit on with pins and two axes, and the one line on how you differ, drafted against the landscape.

### Brand

Studio+. The brand kit, palette (four swatches with a contrast line each, or picked from the logo), display and body fonts, tone words and a tagline, drafted or filled by hand, with the X header, link card and avatar as SVG downloads and brand.json on the export; the public page uses the palette and the link preview image carries it. The logo itself stays on Publish with the public record.

### Viability

Studio+ (M162 onwards). Whether the idea can work on its chain, answered from the record, current chain data and a fixed method. The tab opens with **Where it stands**, one sentence per section with data, each a link to its section. **Can it be built here** starts with the **Assets** the idea depends on, one row per token with a role (collateral, borrowed, quote asset, underlying, reward) and an optional address, each row reading who filled it; **Ask your agent** queues a request your agent reads first on `get_project_status` and answers with `update_project assets`, or copies the prompt. The dependency check, **What is live on this chain**, **Do the numbers work** and **Experiments** fill in through the run. The sidebar lists the four sections and scrolls to each.

### Deployments

One card for the project's chain. It opens with the **Deployer key**, a throwaway key your agent deploys from on both testnets. When your agent is connected, **Ask your agent to make the key** leads: it queues a request the agent reads first on `get_project_status`, makes the key on your machine, writes it to the env file, checks the file is ignored by git and records the address here, and the card then reads "Made by your agent". **Create the key here** makes it in your browser and shows it once as the line to paste into your contracts package's `.env` (`DEPLOYER_PRIVATE_KEY=0x…`), with **Download as .env** to save it as a file; **Where the key lives** reads `.env` from the start and records the path when your repository differs, for example `packages/contracts/.env`, and your agent can set it over MCP (`update_project` `deployerEnvFile`); CanHav never sees or stores the key, only its address and the path. You can also record an address your agent made itself. When the project already records testnet contracts and no deployer, the card reads who deployed one of them from the chain's explorer and offers to record that address, so the record matches what happened; a fresh key is the second path then. With an address recorded, it shows with a copy button, the project's chain shows the balance, **Paste your address** (copies it), **Fund from the faucet** and the explorer link, and the other testnet folds under "Also use this key on"; **Replace the key** asks first, since the new address needs funding again, then clears the address. The balances are read again every thirty seconds while the page is open and whenever you come back to the tab, so the Overview chip and the Launch row turn green on their own once the faucet has paid. Then the testnet contracts, one sentence above them saying these are contracts the project deployed or relies on and that CanHav deploys none, each saved row as text with its explorer link, a copy button and where it came from ("Recorded by your agent, Oct 15", "Added by you", "Recorded by the GitHub sync", or "Recorded earlier" for rows from before the stamp existed) plus Edit and Remove, the address book link, and, for a Studio+ team project, the **Team Safe** (a Safe v1.4.1 owned by the team members' own account wallets, deployed from your connected wallet on the project's testnet through the canonical Safe factory, or an existing Safe recorded by address; CanHav holds no key, the owners and threshold are read from the chain and the record reads "Team Safe 0x…, 2 of 3 owners, verified onchain", the public page says the same and AGENTS.md tells the agent to move contract ownership and admin roles to it before mainnet) and the declared team wallet; the tokens launched from or linked to the project with their token page and explorer links; with Studio+, **Analytics** for those tokens, holders, wallets that have traded, volume and trades over the last 90 days as one line and four daily charts (holders, volume in ETH, trades, new wallets), read from the indexer and filled in as it syncs; with Studio+, **Alerts**, one **Watch this project** switch that has a worker watch every recorded contract and token for ownership changes, pauses, large transfers and curve graduation, a status line from the worker, the channels it sends to (your account email by default, **Connect Telegram** and **Connect Discord** guided, secrets stored encrypted and shown masked), **Send a test alert** to prove delivery without a transaction, and the last ten events (see [Alerts](../token-launch/alerts.md)); and the mainnet record, the contracts, the companion template, the Pons pairing and the external trading pair. See [Projects and launches](../token-launch/projects-and-launches.md).

### Publish

The fields of the public record that no other section holds: name, logo, what it does, who pays, why this chain, the stage, where the first hundred users come from, the GitHub repo, the website and, on a Robinhood project, the distribution acknowledgement. Above the readiness list, **Who can see it** chooses Public or Private for the next publish (see [Public pages](public-pages.md), free accounts keep one private project). With Studio+, **Custom domain** under it connects a host you own: enter it, set the records shown at your DNS host, **Check again** until it reads live, **Disconnect** to release it (see [Public pages](public-pages.md)). Under them the readiness list summarises the record, one row per recommended field with its value, Not stated or Not applicable and the reason, counts the recommended fields still open, and names what still blocks publishing with an **Open Decisions** button where the field lives there. Only the name, a sector, what it does, the stage and the Robinhood acknowledgement block; every other field can be marked not applicable with a short reason that publishes (see [Product track](product-track.md)). Once everything checks out, publish from the header; a private project shows a Private chip there and a **Copy share link** button. The hand off block offers `RESOURCES.md` and `AGENTS.md` built from the draft, the link to launch a token from the project and the prompt that makes an agent load the resource pack.

With Studio+, the **Investor pack** is the last section of the Business model tab (M143, a prompt since M159): **Draft the one pager** and **Draft the deck**, each a control with two ways, **Draft with your agent** (a request your connected agent reads first on `get_project_status` and answers by building the file in the repository or a design tool and recording where it lives with `update_project` `investorPack.files`) and **Copy the prompt** (the item names its length; the prompt carries the whole record, the canvases, the competitor line, build progress, the recorded contracts, the token and the brand kit, then the brief for the output and the brand rules, and asks the AI to mark anything assumed). Under each control the record reads where the built file lives. CanHav writes none of the text any more; a one pager or deck written in the studio before M159 stays readable under "Earlier draft" with its download until removed, and earlier grant answers under "Earlier grant answers". The pack stays on the draft and is never published.

Publishing snapshots the document and assigns a public slug under `/p/...`. See [Public pages](public-pages.md).

## The token design editor

A token design opens at `/studio/token/<id>`. Its sections are described in [Token track](token-track.md). A published design can be launched from `/launch?design=<id>`, which commits the design on-chain. See [Deploy paths](../token-launch/deploy-paths.md).

## Agents in the studio

Every project has its own MCP server, and every launch has a ready prompt. See [Markdown export and MCP](../ai/export-and-mcp.md) for the tools, the write modes, and what an agent can never do (publish, link a token design, or change a locked chain).

## Related

- [The two ideation tracks](two-tracks.md)
- [Product track](product-track.md)
- [Public pages](public-pages.md)
- [Projects and launches](../token-launch/projects-and-launches.md)
