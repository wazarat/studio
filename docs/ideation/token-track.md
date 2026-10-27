# Token track

**Available now.** The studio Token design editor shows seven sections, Rationale, Supply, Vesting, Distribution, Market, Governance and Legal, each with its required answers in view and the optional ones under **More**; the post launch answers (section 8 below) sit under Governance's More. An agent fills any field over `update_linked_token_design`, and `get_project_status` lists the sections still open under `tokenDesign.openSections`.

The Token track is a design document for a token you may or may not deploy. Publishing a design does not deploy a contract. Deploying from a published design is a separate step that commits the design snapshot hash on-chain as `journeyHash`. See [Deploy paths](../token-launch/deploy-paths.md).

## Sections

1. [Token rationale](#1-token-rationale)
2. [Supply and allocation](#2-supply-and-allocation)
3. [Vesting and lockups](#3-vesting-and-lockups)
4. [Distribution](#4-distribution)
5. [Market](#5-market)
6. [Governance](#6-governance)
7. [Legal](#7-legal)
8. [Post-launch](#8-post-launch)
9. [Build steps](#9-build-steps)

Computed panel (float, unlock calendar, warnings) updates as you answer. See [Computed outputs](computed-outputs.md) and [Warnings](warnings.md).

---

## 1. Token rationale

### Asked

| Field | Options / notes |
|-------|-----------------|
| Why does this need a token? | Token is the product; bootstrap supply; economic security; governance; fee capture; fundraising; not sure yet |
| Issuance path | Issue and lock (no market yet); points first; straight to market |
| Beyond a database row | Free text: what economic work only a token can do here |

### Computed

None in this section alone. Answers feed warnings.

### Warnings that can fire

| Warning | When |
|---------|------|
| Does this actually need a token? | “Not sure yet,” or free text that looks like a loyalty / points / cashback program |
| The reason does not fit the product module | The design is linked to a project with a product module and the chosen reason is one every module of that project says to avoid. See the advice block below |

### Module advice

When the design is linked to a project that has a product module, the Rationale step opens with an advice block for that module (or the modules, merged). It says whether a token usually, sometimes or rarely fits the product, which reasons for a token fit and which to avoid, what a token for that module should lock (the fee recipient, the curator role, the pool's founding position) and one example. It is advisory. Nothing in it blocks publishing or changes the launch. The project's MCP server returns the same block as `advice` on `get_linked_token_design`.

---

## 2. Supply and allocation

### Asked

| Field | Notes |
|-------|-------|
| Token name, ticker | Ticker uppercase alphanumeric |
| Total supply | Integer token count |
| Supply policy | Fixed or inflationary (with optional inflation note) |
| Allocation split | Team, investors, treasury/ecosystem, public, liquidity, advisors, other (must sum to 100%) |

Note: the CanHav launch contract mints a **fixed** supply at initialize. An inflationary policy in the design would live in your own contracts, not in the factory token.

### Computed

- Treasury / ecosystem percent (held, not circulating in the unlock model)
- Inputs to float and unlock calendar once vesting, distribution, and market are filled

### Warnings

None specific to this section alone. Low float warnings appear after distribution/market answers.

---

## 3. Vesting and lockups

### Asked

For each vested cohort that has allocation (team, investors, advisors):

| Field | Notes |
|-------|-------|
| Cliff | Months |
| Total duration | Months |
| Release type | Linear; cliff then linear; milestone-conditional |
| If a founder leaves early | Unvested to treasury; to remaining team; continues vesting; no policy yet |

If there is no team, investor, or advisor allocation, vesting is skipped.

### Computed

- Unlock calendar cohort schedules
- Team versus investor cliff comparison
- Milestone-conditional schedules are plotted at the latest month and marked uncertain

### Warnings that can fire

| Warning | When |
|---------|------|
| Team cliff shorter than investors | Team cliff months less than investor cliff months while both have allocation |
| Unlocks clustered | Two or more cohorts’ first unlocks land in the same month (after launch) |

---

## 4. Distribution

### Asked

| Field | Notes |
|-------|-------|
| Distribution event | None (creator holds); airdrop; fixed-price sale; auction/batch; LBP |

If the event is a sale (fixed-price, auction, or LBP):

| Field | Notes |
|-------|-------|
| Price, hard cap | ETH |
| Soft cap, per-wallet limit | Optional ETH |
| Access | Allowlist or open |
| Undersubscription plan | Proceed; refund; postpone; no plan yet |

### Computed

- Public allocation enters month-0 float when a distribution event exists (not “none”)

### Warnings that can fire

| Warning | When |
|---------|------|
| Sale with no undersubscription plan | Sale event and undersubscription = no plan yet |
| Float under 5% | Distribution or market at launch exists and computed float is below 5% |

---

## 5. Market

### Asked

| Field | Notes |
|-------|-------|
| Launch venue | Optional since M69. CanHav curve, Pons or Pools (pools.xyz, the Uniswap launchpad). Where the token first trades after the testnet launch on the CanHav curve. Pons and Pools run on Robinhood Chain mainnet only, so their chips carry that note; on a design linked to an Arbitrum Sepolia project an info block and the launch venue warning appear, and on an unlinked design a note asks for the link. The chosen venue's facts replace the platform facts below, the Build section's market step reads "Ideating for Pons", and the linked project's handoff and Token launch panel carry one line about it. Never injected into an existing design, so a republish hashes the same. |
| Market timing | At launch; later; never |

If at launch:

| Field | Notes |
|-------|-------|
| Liquidity amount | ETH |
| ETH source | Free text |
| LP treatment | Locked (with months); burned; unlocked |
| Anti-sniping | Launch window; early-sell tax; trading delay; none |

### Shown (not asked): fixed by the venue

For the CanHav curve (the default when no venue is chosen):

- Venue and pairing are fixed: token ⇄ ETH on the launch AMM
- Trading fee: 0.30% to LPs; opt-in protocol fee split 70/30 project/platform, enforced in bytecode
- A locked LP position still accrues trading fees to its owner

See [Fees and economics](../token-launch/fees-and-economics.md).

For Pons and Pools the block shows that venue's facts instead (fixed supply of 1 billion, the trading fee and the creator share, the launch window and threshold), checked against their documentation on 2026-10-11 and kept in `content/launch-targets.ts`.

### Computed

- Liquidity allocation enters month-0 float when market is at launch

### Warnings

Low float (same rule as distribution) when market is at launch. Launch venue not on this project's chain when the venue is Pons or Pools and the linked project builds on Arbitrum Sepolia (see [Warnings](warnings.md)).

---

## 6. Governance

### Asked (status declarations)

| Field | Status options |
|-------|----------------|
| Governance mechanism | Already in place; handled by legal/ops; planned before mainnet; not yet |
| Admin key custody | Same |
| Treasury custody | Same |

Framing: most pre-PMF teams have not settled this, and that is fine.

### Shown (not asked): contract guarantees

- Cannot be minted after deployment
- Cannot be paused, frozen, or blacklisted
- Cannot be upgraded: no proxy, no owner
- Source pre-verified: the factory clones a verified implementation

Verify on the explorer: [TokenFactory v4](https://explorer.testnet.chain.robinhood.com/address/0x30Db3A828F65B92434c6aDB27AEeD01850277b08). Full page: [Contract guarantees](../token-launch/contract-guarantees.md).

### Computed / warnings

None from this section.

---

## 7. Legal

### Asked

| Field | Options |
|-------|---------|
| Legal status | Working with counsel; engaging counsel before mainnet; not yet |

Topics typically raised (not stored as separate fields):

- How the token is offered and to whom
- Whether any sale is a securities offering where buyers live
- Tax treatment of allocations, vesting, and treasury sales
- Entity structure holding the treasury and IP

CanHav does not give legal advice. This section records where legal work stands.

### Computed / warnings

None.

---

## 8. Post-launch

All optional. In the editor these sit under Governance, behind **More**, since M131.

### Asked

| Field | Notes |
|-------|-------|
| Treasury runway | Months |
| Reporting cadence | Monthly; quarterly; ad hoc; none yet |
| If the price collapses | Free text plan |
| What would make you call this a failure | Free text |
| Milestones | Optional, two to five dated milestones with a title and an optional description, the same rules as a launch journey. A launch that commits this design's published snapshot reads them as its commitment, so the creator can sell an allocation with proceeds locked to milestone dates, lock supply in escrow against them and post progress updates anchored to each one. The Review step says when the draft has none, when the published snapshot lags the draft (publish again, a launch commits the snapshot, not the draft) and when a launched token committed a snapshot without them. |

### Computed / warnings

None.

---

## 9. Build steps

The editor ends with a Build section before Review, a violet pill labelled with the ticker. It lists sixteen steps in the order a small team takes a token from design to a launched, graduated market. Eight design steps, one per section above, are ticked when the answer is written down; the badge on each jumps to its section. Eight launch stages follow. Publish, link to a project, launch with the design committed, the snipe window and graduation are read from the platform (the row, the entity link, the deployed address and the curve) and cannot be ticked; a row that does not apply, such as the curve rows for a contract deployed elsewhere, is left out of the count. The last three, creating the sale or escrow the design promised, posting the first milestone update and starting the reporting cadence, are ticked by the team. Ticks live on the draft and never enter the published snapshot, so ticking after launch cannot change the hash the launch committed. None of this blocks publishing. Progress shows on the studio row, the public page, the markdown export (section 9) and, for a design linked to a project, on that project's MCP server, where an agent can read and tick the manual steps.

## Related

- [Computed outputs](computed-outputs.md)
- [Warnings](warnings.md)
- [Enforced versus stated](enforced-vs-stated.md)
- [Product track](product-track.md)
- [The three answer types](three-answer-types.md)
- [Deploy paths](../token-launch/deploy-paths.md)
