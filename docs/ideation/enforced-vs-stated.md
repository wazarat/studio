# Enforced versus stated

**Available now** on public token design pages and in the studio.

Readers must be able to tell which claims are written into a contract at deployment and which are published commitments only.

## Labels

| Label | Meaning |
|-------|---------|
| Enforced on-chain | Written into the contract at deployment. Cannot be changed by anyone afterward for that token. |
| Stated by team | Published in the design record (or journey). Not enforced by the token contract. |

## What is enforced on-chain (CanHav launch token)

When you deploy through the CanHav factory:

- Fixed total supply minted at initialize (no later mint)
- No pause, freeze, or blacklist on the token
- No upgrade path and no owner on the token
- Source pre-verified because the factory clones a verified implementation
- Optional vesting wallet parameters you set in the same launch transaction (cliff, duration, percent)
- Launch fee paid at create time

Verify: [Contract guarantees](../token-launch/contract-guarantees.md) and the [TokenFactory](https://explorer.testnet.chain.robinhood.com/address/0x30Db3A828F65B92434c6aDB27AEeD01850277b08).

On a design deploy, the launch transaction also records the design snapshot hash as `journeyHash`, so the published design is tamper-evident relative to that launch. See [Deploy paths](../token-launch/deploy-paths.md).

## What is stated by the team only

These live in the design document / snapshot. They are not rewritten into immutable token bytecode as allocation tables:

- Allocation narrative (who gets what percent among team, investors, treasury, public, liquidity, advisors, other)
- Distribution plans (sale terms, undersubscription plan, airdrop intent)
- Token rationale and “beyond a database row”
- Market plans that are not executed in the launch transaction
- Governance and legal status declarations
- Post-launch runway and reporting intent

A sophisticated reader treats stated commitments as claims to check against later behaviour, not as contract guarantees.

## Status declarations

Legal, governance, and security status fields are always **stated by the team**. See [The three answer types](three-answer-types.md).

## Related

- [Contract guarantees](../token-launch/contract-guarantees.md)
- [Public pages](public-pages.md)
- [Token track](token-track.md)
- [Deploy paths](../token-launch/deploy-paths.md)
