# CanHav Docs (maintainers)

Maintainer notes for the Git Sync source of [docs.canhav.com](https://docs.canhav.com). This file is for contributors. Visitors should land on [Welcome to CanHav](general/welcome-to-canhav.md).

If GitBook still publishes this README as a top-level page, set the site homepage to Welcome in Git Sync / `.gitbook.yaml` and republish.

## Structure

| Group | Path | Focus |
|-------|------|--------|
| Getting started | `general/` + ideation intros | Welcome, what CanHav is, glossary, litepaper, two tracks, three answer types |
| Token Launch | `token-launch/` | Quickstart, the launch form, bonding curve, trading, the token page, linking projects, fees, guarantees, addresses on both chains, risks |
| Studio | `ideation/studio.md` | The studio page and editors |
| Product track | `ideation/product-track.md` | Project / product design |
| Token track (ideation) | `ideation/` | Token design, computed outputs, warnings, enforced vs stated |
| Public pages | `ideation/public-pages.md` | `/p` and `/t` |
| AI and IDE | `ai/` | Markdown export and the MCP servers (shared and per project) |
| Accounts | `accounts/` | Clerk accounts |
| Reference | `reference/` | Networks and factory versions |
| Agent Launch | `agent-launch/` | ERC-8004 (not started; pages retained, demoted) |

Sidebar order is defined in [`SUMMARY.md`](SUMMARY.md). A page's public URL includes its group's name (the app links to `ai-and-ide/export-and-mcp`), so reorder groups freely but do not rename a group or move a page between groups without checking the links that point at it.

## Product surfaces

1. **Token Launch** on Robinhood Chain Testnet and Arbitrum Sepolia (available now)
2. **Projects** ideation tracks and the studio (available now)
3. **Accounts / AI export** (available now)
4. **Foundry scaffold generator** (deferred)
5. **Agent / ERC-8004** (not started)

## Copy rules

- No emojis
- No em dashes (use commas, periods, colons, or hyphens)
- Short pages, one job each
- Status marker on every page: Available now / In development / Deferred / Not started
- Tables for addresses and parameters
- Do not describe in-progress features in the present tense
- Token Launch runs on two chains. Never write "Robinhood only", and give an address together with its chain
- Numbers and addresses come from `content/launch.ts` and `contracts/README.md`, never from another docs page
- Not documented until tested on production: signing in with a wallet and claiming a launch by wallet

## Theme

Light theme / white background is a GitBook **Customization** setting. Steps: [`SETUP.md`](SETUP.md).

## GitBook setup

Repo root [`.gitbook.yaml`](../.gitbook.yaml) sets `root: ./docs/`, homepage to Welcome, and sidebar to `SUMMARY.md`.

Full checklist (space, theme, Git Sync, `docs.canhav.com` DNS): see [`SETUP.md`](SETUP.md).
