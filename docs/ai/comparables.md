# Comparables

Reference research for a project's agent on how existing protocols in the same subsector are built, how they differ from each other and what can go wrong with each design. It comes from the research store behind the networks tab on canhav.co and is served over MCP only, as part of free Studio. There is no page for it in the studio.

## What is in it

- **Entities.** One record per protocol, placed under the Studio subsectors it belongs to: a description, what sets it apart, its components (the contracts and tokens that make it up and what each does), contrasts with other exported protocols (what is the same, what differs, how each positions itself), its risks by category and the external dependencies it leans on, with their severity. Links go to the website, the docs, the GitHub organisation and a few sources (docs, whitepapers, specs). Where CanHav's contract template catalog carries the protocol, `templateIds` names those templates; `get_templates` and `get_template_catalog` have the repo, the license and the deployment status, which the comparables do not repeat.
- **Asset types.** Stablecoins (peg target, peg mechanism, asset subtype, the issuing entity) and receipt tokens (receipt type, base asset, the issuing entity), as design patterns.

## What is left out on purpose

Nothing time bound leaves the store. No metrics (TVL, APY, supply, volume), no dated events, no funding rounds, no "as of" claims, no rankings ("largest", "leading", "dominant"), no news or blog links. If a sentence could be wrong in six months because the world moved, it is not here; sentences that mixed a mechanism with a time bound clause were rewritten by hand to keep the mechanism. A protocol appearing here says nothing about whether it runs on Robinhood Chain or Arbitrum testnets; the template catalog and the resource pack's environment block answer that. Read the linked docs for anything current.

## Tools

| Server | Tool | Arguments |
|--------|------|-----------|
| Shared, no sign in | `get_comparables` | `subsector`, `shape` (resolved through the shape's subsectors), `entity` (one id), `include` (any of `components`, `contrasts`, `risks`, `dependencies`, `links`, all by default) |
| Shared, no sign in | `get_asset_types` | `pegMechanism`, `receiptType`, `baseAsset`; the answer lists the distinct values under `facets` |
| Project | `get_comparables` | `include` only. Bound to the project's subsectors (declared ones plus the ones its modules imply), with `templateIds` per entity so the agent can jump to `get_templates` |

The paste prompt, the kit `SKILL.md` files, `AGENTS.md` and the resource pack's how to use line all tell the agent to call `get_comparables` before proposing architecture and to read the risks for its subsectors before the security review passes.

## How it is regenerated

`npm run gen:comparables -- <path to bootstrap-store.json>` reads the store from a local checkout of `wazarat/canhav-prod` (never at runtime) and writes `content/research/comparables.json`. The generator maps the store's sector and subsector pairs to the Studio subsectors, runs the time filter on every sentence, applies the hand review in `scripts/comparables/review.json` (keep, rewrite or drop per sentence; a new review sentence gets an empty verdict and counts as dropped until a person decides), checks every link once with a cache in `scripts/comparables/links-cache.json` (only a 404 or 410 drops a link; bot protection and server errors keep it), drops dated, news, forum and social links, matches templates by GitHub organisation, docs site or provider name, and prints a summary with the entity counts per subsector, the sentence counts, the dead links and the unmapped sector pairs. `npm run check:comparables` fails when the committed file would change, or, without the store present, validates the committed file's shape and the drop patterns. The loader `lib/comparables.ts` runs the same checks at import, so a malformed file fails the build.

## Related

- [Markdown export and MCP](export-and-mcp.md)
- [Product track](../ideation/product-track.md)
