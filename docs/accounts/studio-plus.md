# Studio+

**Available now.** Studio+ is the paid tier of the studio. It belongs to a team (a Clerk organization), so everyone on the team shares it.

## Price

| Plan | Price |
|------|-------|
| Monthly | $39.99 a month |
| Yearly | $29.99 a month, billed yearly |
| Seats | 3 included, each additional seat $9.99 a month, up to 5 members per team on the current Clerk plan |

Payment is by card in USD through Clerk Billing and Stripe. Tax is not added and refunds are not automatic; write to us for either. Billing is not available in Brazil, India, Malaysia, Mexico, Singapore or Thailand.

## Upgrading

1. Sign in and open [canhav.com/studio/plus](https://canhav.com/studio/plus).
2. Make a team if you have none, or pick one from the account menu in the studio. The plan belongs to the active team.
3. Pick monthly or yearly and pay. The studio then reads **Studio+** everywhere for the team, and the welcome page offers to move your personal projects to it.

Seats are counted by Clerk. Three members and pending invitations fit in the plan; inviting a fourth adds a seat, prorated for the rest of the period. Members and billing live on the Team page (account menu, Team).

## What Studio+ adds

The features ship one by one and are listed on the pricing page, with Soon on the ones still to come. Each one is gated by the project's team plan in the studio, in the API, on the public page and the exports, and on the project's MCP server; a free account sees the five free tabs and one sentence on the Overview pointing at this page.

- Business Model Canvas (the classic grid, each block a few short items you add, edit and remove in place), ICP with a list of real people to contact (name, email, LinkedIn and X as links, contacted and when, the profile they fit; private to the team, never published, exported or sent to a drafting model, read and written by your agent only on a signed in session through `get_prospects` and `set_prospects`, never deleted by it), a Value Proposition Canvas per profile (the value map beside the customer profile, each area a few short items, pain relievers and gain creators linked to the pains and gains they answer, and a fit line naming what nothing answers yet) and Competitor landscape on the Business model tab, Brand identity on the Brand tab
- Private projects (unlisted publish with a share link), version history and project keys
- GitHub sync, automated checks (Slither or Aderyn and a Sourcify lookup in a GitHub Action), monitoring and alerts (one switch has a worker watch every contract and token you record and send to email, Discord or Telegram where the deployment has a bot, with a test alert that proves delivery, see [Alerts](../token-launch/alerts.md)), holder and volume analytics (holders, traders, daily volume and new wallets over 90 days on Deployments and over `get_analytics`)
- Team Safe on Deployments (M160): the team members with a wallet on their account as owners, a threshold, one deploy from the creator's connected wallet on the project's testnet, or an existing Safe recorded by address; owners and threshold read onchain, shown on the public page as verified rather than declared
- Viability on its own tab (M162 onwards): the assets the idea depends on, each with a role and an optional address, filled by your agent from the code with `update_project assets` or by hand, then the dependency check, the gap map of what is live on the chain, the unit economics and the experiments, each answer carrying its source and the date it was read
- Investor pack on the Business model tab (since M159 one prompt per part, the one pager and the deck, carrying the whole record, the canvases, the competitor line, the build progress, the recorded contracts, the token and the brand kit with its palette, fonts, tone, tagline and logo; Draft with your agent queues it, Copy the prompt hands it to any AI, and the record keeps where the built file lives; CanHav no longer writes the text and the grant answers are retired), team updates (a post for the public page drafted from the period's activity, daily, every other day, weekly or only when asked, published from the Overview, named apart from the wallet signed milestone update), tester kit (invite links with steps and per step feedback, no accounts, no keys held), custom domain (a host you own serving the public page, DNS records shown in the studio)
- Priority help, replies within one working day and a booking page for a call

Drafting is agent first: your own IDE agent writes every Studio+ field, and CanHav's server draft is the fallback for a team with no agent connected, within a monthly allowance.

### Drafting

Each section has one Draft control (M141): the button does the likely thing, queueing the draft for your connected agent when the project allows one and drafting with CanHav otherwise, and the chevron beside it opens the three ways, Draft with your agent, Draft with CanHav (with the drafts left this month) and Copy the prompt for an editor without the MCP server. A block inside a section, such as one canvas block, has a Redraft link opening the same menu, and each block queues apart. Under the control one sentence says what stands, "Queued for your agent since" with a Cancel, or "Drafted by your agent on" a day. A connected agent sees open requests first on `get_project_status` (and in AGENTS.md, each naming its block where it has one), writes the field through `update_project`, and that clears the request; writing the whole canvas clears every block request, writing one part of the investor pack clears only that part. Claude Code lists one slash command per kind (`draft_canvas`, `draft_icp`, `draft_competitors`, and the later kinds).

**The brief** (M142). The first time a section is drafted, a short card asks the two to five questions the record does not answer yet, who pays, where the customers are today, what makes them switch, how the product earns, who you will be compared with, the tone words, the ask and the traction, and so on per kind; one or two sentences each, at most 300 characters. Draft saves the answers on the project (under `briefs`, per kind, never published) and runs the draft; Skip, draft anyway runs it without them and is remembered for the session. A question the record already answers (a payer picked, a canvas block filled, tone words set) is not asked. The brief goes to the model as the last block of context, so it is never cut, and the short kinds run with more reasoning when one is given; your agent reads it on `get_project_status` under each open request, in the `draft_<kind>` prompt and in AGENTS.md.

With agent writes off, or from Draft with CanHav in the menu, CanHav drafts on its side: the project record (the same markdown the export produces), a short kit summary, the fields named for that draft and the team's brief for the kind go to Anthropic's API, on Claude Haiku 5.5 for the canvas, the profiles, the value proposition canvas, the competitor line, the brand kit and the team update. The investor pack is not drafted by CanHav since M159. Nothing from your repository and no keys are sent. The answer lands in the draft as an edit you can change, the field reads "Drafted by CanHav", and a team has 60 server drafts a month across every kind; the button shows what is left. A draft that is refused, cut off or malformed fails plainly and counts against nothing. An answer longer than a field's limit is cut at a word, never mid word, and the agent's proposals of profiles, palettes, decks and grant answers read as labelled lines in the agent feed.

## Priority help

Studio+ teams get replies within one working day and a booking page for a call, both from the pricing page. There is no partner perks list; nothing is agreed with a partner, so nothing is promised.

## Cancelling and downgrading

Cancel from the Team page. The plan runs to the end of the paid period, then the team reads Studio again. Records stay where they are; a private project beyond the free allowance stays private and cannot be republished until it is made public, and the Studio+ sections of a project stay stored but closed until the team is back on the plan.

A project's plan is its team's plan (M134). While a team is off Studio+, the paid fields of its projects are refused on `update_project`, the draft prompts and the studio autosave (the stored values stay on the draft), publishing leaves the Business Model Canvas, the ideal customers, the brand kit and the competitor line out of the new snapshot, the public page, the share image, the exports, `get_project` and `AGENTS.md` serve the record without them, the one pager page, the brand and pack downloads, the custom domain and the tester links pause, the team updates leave the public page, and the alerts worker stops watching the team's contracts (rules are kept). A Studio+ account working on a personal project sees a card offering to move the project to the team instead of the paid sections. Everything opens again when the plan is active.

## What stays free

Everything documented before Studio+: projects, token designs, publishing, launching, the shared MCP server and the project servers, exports, and one private project.

## Related

- [Accounts and teams](clerk-accounts.md)
- [Studio](../ideation/studio.md)
