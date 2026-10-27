# Deploy paths

**Available now** on Robinhood Chain Testnet and Arbitrum Sepolia.

There are two ways to launch a token through `/launch`: a quick deploy from the form, and a design deploy from a published token design. Both go through the [CurveLauncher](bonding-curve.md). They differ in what `journeyHash` means and how the token page labels the launch. Either can also start from a studio project.

## Quick deploy (no design record)

Use `/launch` without a design id.

1. You fill [the launch form](launch-form.md) (name, ticker, description, image, optional developer buy, optional commitment).
2. With **Add a commitment** switched on, the launch commits a **JourneyDoc** hash as `journeyHash` and stores the document. On `/launch/t/[address]`, when that hash resolves in the journeys table, the page shows:

**Quick deploy, no design record**

That label means this token was launched without a published token design snapshot. There is no design page to attach by default.

3. With the commitment left off, `journeyHash` is zero. The page shows **Launched without a commitment**, and the token has no milestones for sales, escrow or progress updates.

## Design deploy

Use `/launch?design=<id>` from a **published** token design (or an equivalent entry point that passes the design id).

1. The form prefills from the design (name, ticker and supply; a team vesting cohort is shown as a published commitment, not applied).
2. The commitment toggle is replaced by the design. The Launch step shows a design commitment card.
3. The launch commits the design **snapshot hash** as `journeyHash`. The journeys POST for a classic JourneyDoc is skipped. The milestones in the design's Post-launch section, as published in that snapshot, become the launch's milestones; the Launch step says how many it carries, or that it carries none.
4. On success, attach-deploy links the on-chain token to the design (server re-verifies via indexer `journeyHash` match).
5. On `/launch/t/[address]`, when that hash resolves in `ideation_snapshots`, the page shows **Design committed on-chain**, links to the design, re-hashes the snapshot against the on-chain value and lists its milestones with their updates. With verified milestones the creator gets the same sale, escrow and milestone update actions as a journey launch; without them the page says so and those actions stay off.

Publishing a design does not deploy. Deploying is a separate wallet transaction.

## Starting from a project

`/launch?project=<id>` starts a launch from one of your studio projects (you must be signed in as its owner). The launch goes on the project's chain, so the chain chooser is hidden, and the launch is linked to the project when it succeeds. If the project has a published linked token design, that design is committed too, as in a design deploy. See [Projects and launches](projects-and-launches.md).

## Attaching an existing token to a design

`/launch/attach` links a token that is already deployed to a published token design. It works only when the token's on-chain `journeyHash` equals that design's snapshot hash. For a launch more than 15 minutes old, the wallet that created the token signs a message to prove it. Nothing is sent on-chain.

## How journeyHash discriminates the path

| Path | What journeyHash is | Where it resolves |
|------|---------------------|-------------------|
| Quick deploy with a commitment | Hash of the v1 JourneyDoc | `launchpad.journeys` |
| Quick deploy without one | Zero | Nowhere. The page says "Launched without a commitment" |
| Design deploy | Content-addressed ideation snapshot hash | `launchpad.ideation_snapshots` |

The table the hash resolves in is the path discriminator. No separate on-chain flag is required.

If a non-zero hash resolves in neither table, the token page shows that there is no design record (and no verified journey document).

## Why the Quick deploy label exists

Readers should not confuse a free-form journey launch with a published, snapshotted token design. The label makes the missing design record visible instead of silent.

## Related

- [The launch form](launch-form.md)
- [Create a token](create-a-token.md)
- [Journey and credibility](journey-and-credibility.md)
- [Public pages](../ideation/public-pages.md)
- [Token track](../ideation/token-track.md)
- [Enforced versus stated](../ideation/enforced-vs-stated.md)
