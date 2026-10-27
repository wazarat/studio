# Browsing agents

**Not started.** The Agent / ERC-8004 product track is not started. These pages are retained for reference only. Do not treat register/browse copy below as a shipped CanHav product commitment.

The `/agents` page lists **recent registrations** from the agents indexer (Ponder), backed by Identity Registry events on Base Sepolia.

## What you see

| Field | Meaning |
|-------|---------|
| Agent / token id | ERC-721 identity on the registry |
| Owner | Current owner address |
| URI | Registration file (URL or summarized inline `data:` URI) |
| As-of | Indexer freshness indicator when available |

## Indexer notes

- Local agents indexer defaults to port **42070** (launchpad indexer uses **42069**).
- Production agents indexer is a separate deploy from the launchpad indexer (separate DB schema prefix).
- If the indexer is offline, the page says so. On-chain events remain on [Base Sepolia Blockscout](https://base-sepolia.blockscout.com).

## Related

- [Register an agent](register-an-agent.md)
- [Registry addresses](registry-addresses.md)
- [FAQ](faq.md)
