# Risks

**Available now** as a reference. Read it before you launch or trade.

Token Launch is a testnet product for builders and testers. Nothing on it is an offer, a recommendation or investment advice.

## The basics

- **Testnet only.** Both chains are testnets. Testnet ETH and the tokens launched here have no value, and a testnet can be reset or retired by its operator.
- **Tokens can go to zero.** A bonding curve prices a token by what has been bought and sold. Sellers can take the price back down as fast as buyers took it up.
- **Names are not unique.** Anyone can launch a token with any name and ticker. Check the token **address** and its chain, not the name.
- **Transactions are irreversible.** A confirmed launch, buy or sell cannot be undone, and nothing about a token can be edited after launch.

## Things that are easy to misread

- **Graduation is not a quality signal.** It means 0.1 ETH was raised on the curve. It says nothing about the project.
- **Locked liquidity is not a price floor.** The pool's liquidity cannot be withdrawn, so there is always something to trade against. The price still moves with every trade.
- **A commitment is a statement, not enforcement.** A committed document proves what was said at launch. Only the supply is enforced by the token contract. See [Enforced versus stated](../ideation/enforced-vs-stated.md).
- **The snipe tax applies to you too.** Any buy in the first 60 seconds pays 20%, except the launcher's own first buy inside the launch transaction.
- **The chart is a guide.** It is drawn from trade prices, not from candles, and covers the most recent 1000 trades per venue.

## The platform

- **No audit is on record.** The contracts have tests and verified source for the launcher and factory, but no third-party audit is published. Treat them as unaudited.
- **Admin controls exist.** A timelock on each chain can change the launch fee within a hard cap and unpause. A pauser can pause new launches and curve buys at once. Sells cannot be paused. See [Governance](governance.md).
- **Off-chain parts can be unavailable.** The site, the indexer and the stored documents can go down. The tokens and their markets live on-chain and are unaffected, and the hashes in the launch event still let anyone verify a document.
- **Address strings repeat across chains.** Some contract addresses are the same string on both chains but are different contracts. Always read an address together with its chain. See [Contract addresses](contract-addresses.md).

CanHav has no affiliation with Robinhood.

## Related

- [Contract guarantees](contract-guarantees.md)
- [Fees and economics](fees-and-economics.md)
- [FAQ](faq.md)
