# Projects and launches

**Available now.** Requires a CanHav account.

A **launch** is a token on-chain. A **project** is the studio record of what you are building around it. Linking the two is optional and can be done at any point. The link is a CanHav record, not an on-chain change, and it can be changed or removed.

A launch can be linked only when it is recorded to your account, which happens when you launch while signed in.

## Why link

- The token page shows the project (its name once the project is published).
- The project's own MCP server can read the token, so an agent working on the project also sees the curve, the pool and the sales. See [Markdown export and MCP](../ai/export-and-mcp.md).
- The studio lists the launch under its project.

## Ways to link

| Where | How |
|-------|-----|
| The launch form | The optional **Project** block: link one of your projects, or start a project for this token. See [The launch form](launch-form.md). |
| From a project | The **Launch a token from this project** link in the project's Token launch panel opens `/launch?project=<id>`. The launch is linked automatically and goes on the project's chain. |
| Studio, Launches list | **Link a project** on the launch's row. Pick one of your projects, or **Start a project for this token**. |
| Studio, project page | The **Token launch** panel on Overview lists your unlinked launches on the project's chain, and takes a token's address, short form or page link to link one. |
| The token page | The **Link a project** button across from the name, shown to the account that owns the launch. |

Once linked, the same controls offer **Change** and **Unlink**.

## Start a project for this token

This creates a draft project named after the token, on the token's chain. When it is created from the launch form, the token's description becomes the opening answer to what the project does. You finish the rest in the studio, by hand or with an agent.

## Rules

- **Same chain.** A launch links only to a project on the chain the token launched on. Projects on the other chain are not offered.
- **The chain locks.** Once a project has a linked launch, or a deployed linked token design, its chain cannot be changed. Unlinking the only launch releases it.
- **Your own only.** Both the launch and the project must belong to the signed-in account.
- **Launches from a token design.** A token deployed from a published token design reaches its project through the design. Link the design and the project in the studio instead.
- **Launched records stay.** A project or token design with a launched token reads **Launched** in the studio, moves out of the drafts lists to the Launches summary and `/studio/launches`, and cannot be deleted while the launch points at it.
- **Agents cannot link.** Linking and unlinking a launch is done by the owner. No MCP tool does it.

## Which token a project reads

A project's MCP server reads one token: the token deployed from its linked design when there is one, otherwise the most recent launch linked to the project.

## Mainnet and the Pons pairing

A project can record its mainnet deployment beside the testnet launch, under Deployments on the project page. The contracts live on the mainnet the project's chain stands in for, Robinhood Chain (4663) for a Robinhood testnet project and Arbitrum One (42161) for an Arbitrum Sepolia project, and the public page, the Token launch panel and the exports link each address to that mainnet's explorer. The companion contract is picked from the templates the team accepted under Build that carry a Pons fit line, and on a Robinhood project the Pons launch it is paired with is recorded with its token address and the creator fee recipient. Pons runs on Robinhood Chain mainnet only, so an Arbitrum project records contracts and a companion but no pairing. Agents read the record on `get_project_status` and `get_launch` and write it through `update_project`.

## Related

- [Studio](../ideation/studio.md)
- [The two ideation tracks](../ideation/two-tracks.md)
- [Clerk accounts](../accounts/clerk-accounts.md)
