# Agent Launch FAQ

**Not started.** The Agent / ERC-8004 product track is not started. These pages are retained for reference only. Do not treat register/browse copy below as a shipped CanHav product commitment.

## Why do I see a configuration error about `0x8004A818`?

The Identity Registry address is missing or does not start with the **Base Sepolia** vanity prefix. Mainnet registries start with `0x8004A169`. Fix the env / config and redeploy. See [Registry addresses](registry-addresses.md).

## Is Agent Launch on Robinhood Chain?

No. Agent Launch is **Base Sepolia** (`84532`). Token Launch is Robinhood Chain Testnet (`46630`).

## Does CanHav own the Identity Registry?

No. Registries are public ERC-8004 singletons. CanHav only builds UI, guards, and an indexer against them.

## Recent registrations are empty

The agents indexer may be offline or still syncing. Check Blockscout for registry events, then retry. Locally the agents indexer uses port `42070`.

## When can I register an MCP-only agent?

MCP gating is the intended constraint for this track. Watch [MCP endpoints](mcp-endpoints.md) and [Roadmap](roadmap.md) as the gate lands in product.

## Should I use this on mainnet?

No. Agent Launch docs and product guards are testnet-only for now.

## Where should I start if I care about tokens first?

Start with [Token Launch overview](../token-launch/overview.md). That is the current focus.
