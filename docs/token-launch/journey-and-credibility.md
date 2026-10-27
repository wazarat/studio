# Journey and credibility

**Available now.**

A **journey** is the off-chain plan for a token: why it exists, the supply rationale, and dated milestones. It is the **commitment** a launcher can choose to make. At launch, CanHav records hashes on-chain so anyone can verify that a published document matches what was launched.

The description hash is always recorded. The commitment is optional: on the launch form it is the **Add a commitment** toggle, and a launch from a published token design commits that design instead. Without either, `journeyHash` is zero and the token page says "Launched without a commitment".

## Two commitments

| Hash | Commits to |
|------|------------|
| `descriptionHash` | Short description from the launch form. The text is stored off-chain and shown only when it re-hashes to this value |
| `journeyHash` | The journey document stored off-chain, or a published token design's snapshot when the launch was made from a design. Zero when the launch made no commitment |

They are independent. Changing one document does not rewrite the other hash. Verification is: hash the published bytes and compare to the event.

## Why it matters

Launch pages often make claims that never appear on-chain. Binding a journey hash in the launch transaction means:

- The launch event is the source of truth for “what was promised at t0”
- Later [journey updates](journey-updates.md) can add content-addressed progress without rewriting the original commitment
- Explorers and indexers can surface the hashes even if hosting moves
- The milestones in the document are what [escrow](milestone-escrow.md), [allocation sales](allocation-sales.md) and progress updates are scheduled against. A token with no commitment cannot use them

## Format notes

Journey document format may evolve. Smoke-test launches have used placeholders. Treat the **hash in the event** as the contract with the chain; treat the hosted file as the human-readable payload that must match.

## Related

- [The launch form](launch-form.md)
- [Deploy paths](deploy-paths.md)
- [Journey updates](journey-updates.md)
- [Milestone escrow](milestone-escrow.md)
