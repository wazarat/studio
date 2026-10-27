# Milestone escrow

**Available now.**

**MilestoneEscrow** is an admin-less singleton, deployed once on each chain. It holds token lockups that unlock on milestone dates.

Lockups are made against a token's milestones, so only a token launched with a [commitment](journey-and-credibility.md) can use it. The creator locks supply from [the token page](token-page.md).

## Properties

| Property | Detail |
|----------|--------|
| Address | See [Contract addresses](contract-addresses.md) |
| Ownership | None. No owner, no attester, no pause. |
| Role | Milestone-dated lockups for launch credibility |

Because there is no admin, unlock schedules cannot be silently rewritten by a CanHav operator key. Rules are whatever the contract encodes at deposit time.

## How it fits the journey

Escrow pairs with [journey hashes](journey-and-credibility.md) and [journey updates](journey-updates.md):

- Journey commits the plan
- Escrow locks tokens to dates or milestones in that plan
- Updates publish progress against the plan without needing a privileged attester

## Related

- [Allocation sales](allocation-sales.md) (proceeds also use milestone-dated unlocks)
- [Contract addresses](contract-addresses.md)

## Design launches

A token launched from a published design commits the design's snapshot hash instead of a journey. The milestones in the design's Post-launch section are the launch's milestones, verified the same way (the snapshot re-hashes to the on-chain value), so everything on this page that references the journey's milestones applies to them by index. A design published without milestones gives the launch nothing to schedule against.
