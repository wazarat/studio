# Accounts (Clerk)

**Available now.** CanHav accounts use **Clerk**.

## Sign up and log in

Sign-up is open to everyone, with an email address. Create an account at [canhav.com/sign-up](https://canhav.com/sign-up). The **Log in or sign up** button in the navigation opens `/studio`, where existing accounts log in and new ones can follow the link to sign up.

## Accounts and wallets are separate

Your CanHav account and your wallet are two different things.

- The **wallet** signs on-chain actions: launching, buying, selling, and creator actions on a token.
- The **account** owns your studio records: projects, token designs, and the launches recorded to it.

Connecting a wallet does not sign you in, and signing in does not connect a wallet. On-chain actions through CanHav need both: you sign in first, then the wallet signs.

A launch is recorded to your account the moment its transaction confirms, so it appears in the studio. A token launched before sign-in was required, or one whose link did not complete, can be claimed from its token page with the wallet that created it.

## What requires an account

- Launching a token, buying and selling, and creator actions on a token page (pools, sales, escrow and progress updates)
- Creating and editing project and token design drafts in the [studio](../ideation/studio.md) (`/studio`)
- Publishing and unpublishing those drafts
- Linking a project to a token design
- Seeing your launches in the studio and [linking a launch to a project](../token-launch/projects-and-launches.md)
- The agent prompt for a launch, a project's own MCP server, and its agent-write setting
- Markdown export and the `get_my_` MCP tools for your own designs and launches (see [AI and IDE](../ai/export-and-mcp.md))

## What does not require an account

- Reading research on [canhav.com](https://canhav.com)
- Reading published docs on [docs.canhav.com](https://docs.canhav.com)
- Exploring launched tokens
- Reading public token, project and token design pages (`/launch/t/...`, `/p/...`, `/t/...`)
- Reading public data over the shared MCP server

## Teams

**Available now.** A team is a Clerk organization. Create one from the account menu in the studio (Create a team), invite people from the Team page, and switch between your personal account and your teams from the same menu. The nav reads the active one.

A record you make while a team is active, on Studio+, belongs to that team, and a personal project can be moved to the active team from its page (Move to team). Moving takes the project, its linked token design and the launches started from it. Every member of the team can then open and edit them, in the studio and through the project's MCP server. The record keeps the account that made it as its creator, and only that account can move it. A record on a team stays there.

Agent proposals, sessions and the summary on a team project are shared the same way, so a teammate can accept a change the agent proposed to you. Launches recorded by the team's members for a team project are listed for everyone on it.

Seats on a team are counted by Studio+, see [Studio+](studio-plus.md).

## What data is stored

| Data | Purpose |
|------|---------|
| Account identity (via Clerk) | Authenticate studio owners (`owner_id` on drafts) and, for a team record, the organization it belongs to (`org_id`) |
| Draft project / token design documents | Autosave and edit |
| Publish snapshots and slugs | Public pages (insert-only snapshots) |
| Optional link rows between project and token design | Cross-links |
| Optional attach of deployed token address to a design | Connect design to on-chain launch |
| Launch records | Which account a launch is recorded to, the creator address read from the chain, and the project it is linked to |
| Agent change records | What an agent proposed or wrote on a project, when its owner allows agent writes |
| Project file references | Pointers to your own files that you add to a project. Never published |

CanHav does not need your private keys. Do not paste seed phrases into any CanHav form.

Exact retention and deletion controls will be documented when account management is production-ready.

## Cost

Accounts and the studio surfaces described here are **free**. [Studio+](studio-plus.md) is the paid tier for teams; it adds features on top of them and never takes any of them away.

## Related

- [Studio](../ideation/studio.md)
- [Public pages](../ideation/public-pages.md)
- [AI and IDE](../ai/export-and-mcp.md)
- [The two ideation tracks](../ideation/two-tracks.md)
