# Public pages

**Available now.** Project pages live at `/p/[slug]`. Token design pages live at `/t/[slug]`. Launched tokens are listed at `/explore`, and published projects at `/explore?view=projects` (both reachable by URL, not from the navigation).

## Separate entities

Projects and token designs are **separate** public documents.

- A project page describes the product.
- A token page describes the token design (and computed outputs).
- They can be **cross-linked** when the team links them in studio and both are published.
- They are **not merged** into a single page. Readers should always know which entity they are looking at.

## Credibility signals stay scoped

Signals that belong to a project stay on the **project** page:

- Deploy history for a verify wallet (tokens created by that address)
- Blockscout verification status for listed testnet contracts
- Wallet transaction count
- GitHub commit activity for a linked repo

Each signal is omitted silently if the lookup fails. Nothing is invented to fill a gap.

Signals that belong to a token design stay on the **token** page:

- Computed float, FDV:float, unlock calendar, warnings
- Enforced versus stated labels
- Attached deploy address when present

Linking the two does not import one entity’s credibility into the other by default.

## Publishing

When you publish:

1. The draft is snapshotted (content-addressed, insert-only).
2. A public slug is assigned (immutable after first publish).
3. The public page renders the snapshot, not the live draft.

Unpublishing flips status back to draft for editors. Snapshots are not deleted.

### Private projects

A project can be published **private** (Publish section, Who can see it). A private project stays off Explore and the listings and is never indexed. Its page, its exports and the shared MCP server's `get_project` open for the project's team and for anyone with the **share link**, which carries a token (`/p/<slug>?s=<token>`) minted at the first private publish; the slug alone is not enough. Copy the link from the project header. Free accounts keep one private project; [Studio+](../accounts/studio-plus.md) has no cap. A project with a launched token stays public; unlink the launch first. Token designs are always public, because a launch commits their snapshot hash on chain.

A Credit project's research kit (its product module, starting point and resource pack ticks) is part of the draft, so it is inside the snapshot too. Changing a tick after publishing means the next Republish produces a new version.

## Custom domain

A Studio+ team can serve a public project's page at a host it owns (Publish section, Custom domain). CanHav adds the host to its deployment and shows the DNS records to set, an `A` record for an apex domain or a `CNAME` for a subdomain plus a `TXT` record that proves ownership; once the DNS resolves, the root of that host shows the project page and becomes the page's canonical address, while the `/p/...` page stays. A private project keeps its share link instead; a host can serve one project at a time.

## Team updates

A Studio+ team can publish short team updates to its project page from the Overview, daily, every other day, weekly or only when it asks (see [Studio](studio.md)). The page shows the published ones newest first, each labelled by its day, its two days or its week, each with its body and highlights, beside the snapshot; a draft week stays private until it is published. These are the team's own words, not the wallet signed milestone updates a token's journey anchors on chain (see [Journey updates](../token-launch/journey-updates.md)).

## Deployed tokens

A published token design may attach a deployed contract address after a design deploy. That attachment is optional. A design that is never deployed remains a legitimate public document.

For tokens launched from the launch form without a token design, Explore and `/launch/t/[address]` remain the Token Launch surface, with a Quick deploy label when the launch carries a commitment. See [Deploy paths](../token-launch/deploy-paths.md).

A project page also lists the tokens launched from or linked to the project. See [Projects and launches](../token-launch/projects-and-launches.md).

## Related

- [The two ideation tracks](../ideation/two-tracks.md)
- [Token track](../ideation/token-track.md)
- [Product track](../ideation/product-track.md)
- [Enforced versus stated](enforced-vs-stated.md)
- [Accounts](../accounts/clerk-accounts.md)
