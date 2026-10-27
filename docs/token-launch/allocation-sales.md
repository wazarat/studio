# Allocation sales

**Available now.**

**AllocationSale** is an admin-less singleton for fixed-price token sales, deployed once on each chain.

A sale is scheduled against a token's milestones, so only a token launched with a [commitment](journey-and-credibility.md) can run one. The creator opens a sale from [the token page](token-page.md).

## Properties

| Property | Detail |
|----------|--------|
| Address | See [Contract addresses](contract-addresses.md) |
| Platform cut | Zero (fee-free) |
| Proceeds | Claimable only in milestone-dated tranches |
| Ownership | None |

## Design intent

Sales should not depend on an operator to “release” proceeds at will. Milestone-dated lockups align cashflow with the same credibility model as [MilestoneEscrow](milestone-escrow.md).

## Related

- [Milestone escrow](milestone-escrow.md)
- [AMM and fees](amm-and-fees.md)

## Design launches

A token launched from a published design commits the design's snapshot hash instead of a journey. The milestones in the design's Post-launch section are the launch's milestones, verified the same way (the snapshot re-hashes to the on-chain value), so everything on this page that references the journey's milestones applies to them by index. A design published without milestones gives the launch nothing to schedule against.
