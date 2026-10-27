# Computed outputs

**Available now** with the Token track. Derived values are computed live from your answers. They are not stored as separate fields. Public pages recompute them server-side from the published snapshot.

## Why these are computed rather than asked

Asking for “float at launch” or “FDV to float” invites inconsistent math. The platform already has allocations, vesting schedules, distribution timing, and market timing. Deriving the outputs once keeps the public page honest and keeps the editor from arguing with itself.

Modeling assumptions:

- Treasury / ecosystem and “other” allocations are **held**, not circulating. They do not enter float or the unlock calendar.
- **Public** allocation circulates at month 0 when a distribution event exists (not “none”).
- **Liquidity** circulates at month 0 only when a market exists at launch.
- **Linear** vesting: at the cliff month the accrued fraction releases, then equal monthly releases through the duration.
- **Cliff then linear**: nothing at the cliff, then the full amount spreads over months after it.
- **Milestone-conditional**: cannot be dated; plotted at the latest month (duration) and marked uncertain.

## Circulating float at launch

Percent of total supply that unlocks in month 0 under the rules above.

## Fully diluted to float ratio

`100 / floatAtLaunchPct` when float is greater than zero. Null when float is zero (for example issue-and-lock with no market).

A high ratio means a small liquid float is setting the price for a much larger fully diluted supply.

### Worked example

A **4%** circulating float at launch produces:

`100 / 4 = 25`

So the fully diluted to float ratio is **25×**. If the market quotes a price from that 4% float as if it were the whole supply, the implied fully diluted valuation is twenty-five times the capital that can actually trade. A 1% float would be 100×; a 20% float would be 5×.

## Unlock calendar

Month-by-month unlock of circulating cohorts (public, liquidity, team, investors, advisors), as percent of total supply.

### Cluster warnings

If two or more cohorts’ **first** unlocks (after month 0) land in the same month, the design fires an **unlock cluster** warning. Cliffs that coincide concentrate sell pressure on a date the market can see coming.

## Team versus investor terms

Side-by-side cliff and duration for team and investors when both have allocation.

If the team cliff is **shorter** than the investor cliff, the design fires **team cliff shorter than investors**. Readers treat that as adverse selection.

## Warning set (summary)

Full rules and worked examples: [Warnings](warnings.md).

| Warning | Trigger |
|---------|---------|
| Float under 5% | Distribution or market at launch, and float below 5% |
| Team cliff shorter than investors | Team cliff months less than investor cliff months |
| Unlocks clustered | Two or more cohorts first-unlock in the same month (>0) |
| Sale with no undersubscription plan | Sale event and “no plan yet” |
| Does this actually need a token? | Rationale “not sure,” or loyalty/points-style free text |

Near-zero float is **not** treated as a problem when you are issuing and locking with no market. That path is intentional.

## Related

- [Token track](token-track.md)
- [Warnings](warnings.md)
- [The three answer types](three-answer-types.md)
- [Enforced versus stated](enforced-vs-stated.md)
