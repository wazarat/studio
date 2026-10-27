# Warnings

**Available now.** Warnings fire on risky design answers. They are not validation errors. You can still publish. Public pages and the studio computed panel show the same warning cards with worked examples.

Near-zero float does **not** fire when you are issuing and locking with no market. That path is intentional.

## Float under 5%

**Trigger:** A distribution event or market at launch exists, and circulating float at launch is under 5%.

**Meaning:** A tiny circulating float makes the quoted price nearly meaningless. A small buy moves it violently up, the first unlock moves it violently down, and holders discover the fully diluted valuation was the real number all along. Low float plus high FDV is a common launch structure that ends badly.

**Worked example:** 3% float at a $10M FDV means $300k of real tokens set the price for the other $9.7M. When a month-6 cliff releases 15%, supply grows about 6× at once. Compare: a 15% float absorbs the same unlock as a 2× change.

Related: [Computed outputs](computed-outputs.md) (4% float → 25× FDV:float).

## Team cliff shorter than investors

**Trigger:** Team and investors both have allocation, and team cliff months are less than investor cliff months.

**Meaning:** The team can start exiting before the people who funded the project. Readers treat that as adverse selection. Standard practice is team terms at least as long as investor terms.

**Worked example:** Team 6-month cliff / 24-month vest vs investors 12-month cliff / 24-month vest. The team can sell for six months while investors are still locked. Flip the cliffs (team 12, investors 6 to 12) and the signal reverses.

## Unlocks clustered in the same month

**Trigger:** Two or more cohorts’ first unlocks (after month 0) land in the same month.

**Meaning:** Cliffs that coincide concentrate sell pressure into a single date the market can see coming. Staggering them by even a quarter spreads the supply shock.

**Worked example:** Team and investors both cliff at month 12 → a large share of supply becomes liquid in one week. Staggered (investors month 9, team month 15), each event is smaller and the market has a price between them.

## Sale with no undersubscription plan

**Trigger:** Distribution is a sale event (fixed-price, auction, or LBP) and undersubscription is “no plan yet.”

**Meaning:** If the sale does not fill, something happens by default. Default outcomes are often the worst: a half-funded treasury, an accidental low-float launch, or a quiet cancellation that burns trust. Decide: proceed, refund, or postpone.

**Worked example:** A 1,000 ETH hard-cap sale raises 180 ETH. Proceed anyway → you launch with 18% of planned runway and the same promises. Refund → buyers are whole and you re-scope. Postpone → you keep optionality. All three beat finding out live.

## Does this actually need a token?

**Trigger:** Rationale “why” is “not sure yet,” or the “beyond a database row” text matches loyalty / points / cashback-style language.

**Meaning:** If a database row, a Stripe account, or a points table would do the same job, the token adds regulatory surface, sell pressure, and a second product to run, and removes nothing. Loyalty-style rewards are a classic false positive. A respectable exit is to publish a project and skip the token until it earns its place.

**Worked example:** “Users earn tokens for referrals” is a points column. “LPs stake the token to underwrite risk and get slashed on bad debt” cannot be a database row. The token is doing economic work a ledger entry cannot.

## The reason does not fit the product module

**Trigger:** The design is linked to a project with a product module, and the rationale "why" is a reason every one of that project's modules lists under "reasons to avoid" (for example Fundraising for a curated vault, or Bootstrapping a supply side for an earn feature inside an app). Fires only through the linked project. The public design page and an unlinked design never show it. The public `check_design` MCP tool reports it once the linked project is published.

**Meaning:** Each product module carries advice on whether a token fits, which reasons hold up and what a token for that module should lock. The advice block on the Rationale step lists them. Pick a reason that fits, or write down in the "beyond a database row" field why this product is the exception. Advisory only; it never blocks publishing and never changes the launch.

**Worked example:** An earn feature inside a wallet picks Bootstrapping a supply side. The vaults it routes to already have suppliers, so the emissions would pay for nothing. Fee capture on the cut the app keeps is the reason that fits.

## The launch venue is not on this project's chain

**Trigger:** The design is linked to a project, the Market section names Pons or Pools as the launch venue, and the project builds on Arbitrum Sepolia (which stands in for Arbitrum One). Pons and Pools run on Robinhood Chain mainnet only. Fires only through the linked project, in the studio computed panel, on `get_linked_token_design` and `check_design` on the project's MCP server, and on the public `check_design` tool once the linked project is published.

**Meaning:** The testnet launch on the CanHav curve is unaffected. Taking the design to that venue afterwards would need a Robinhood Chain project, or a different venue. Advisory only; it never blocks publishing and never changes the launch.

**Worked example:** A design picks Pons while its project builds on Arbitrum Sepolia. The team launches on the CanHav curve on Arbitrum Sepolia as planned, then either starts a Robinhood Chain project for the mainnet launch or switches the venue to the CanHav curve.

## Related

- [Computed outputs](computed-outputs.md)
- [Token track](token-track.md)
- [The three answer types](three-answer-types.md)
