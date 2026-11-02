# Studio

The next CanHav platform, rebuilt one step at a time from
[canhav.dev](https://github.com/wazarat/canhav.dev). Only the parts that have
been approved move over; canhav.dev stays as the reference copy.

## Step 1 (this repo today)

- `/` — the landing page from canhav.dev, dark only: nav (logo, Docs, Log in),
  hero video with the two headline lines and the sign up / contact buttons,
  the Protocol analytics section and the Pro Services panel, footer.
- `/login` — a placeholder page in the spot where sign-in will go.
- `/api/leads` — the contact form endpoint, answering "not connected yet"
  until the database and email are wired.
- `docs/` — the markdown behind docs.canhav.com, carried over unchanged for
  when Studio hosts the docs itself. The app does not read it yet.

## Step 2: accounts

Clerk, shared with canhav.dev, with a sign-up flow of our own:

- `/login` — Clerk's prebuilt sign-in and sign-up cards, as on canhav.com:
  email with a verification code, Google, or a wallet (MetaMask, Base). A
  wallet sign-up is asked for its email because the instance requires one.
  `?mode=signup` shows the sign-up card.
- `/studio` — the signed-in home, for now the heading and subtitle. An
  account that has not finished signing up gets a pop-up with the steps:
  your name and username (required, the username is the byline on public
  project pages) with the unticked "Send me product updates" checkbox, an
  avatar (optional; a Google picture shows and can be removed), and how you
  build (role, experience, AI IDE; optional). Saved on the Clerk
  user: name, username and image on the user itself, the rest under
  `unsafeMetadata.studio`. A small popup follows the last step.
- The avatar at the top right opens Account (Clerk's profile) and Sign out.

### Clerk setup

Until the canhav.com domain moves to Studio, use the **Development instance**
keys (`pk_test` / `sk_test`) in `.env.local` and in the Vercel project; the
production instance is bound to canhav.com. Settings on that instance, under
User & authentication:

- Email address on and required, verified at sign-up with an email code; email
  code enabled as a sign-in method.
- First and last name on, not required at sign-up. Username on, not required,
  minimum length 3.
- Password off (or optional); phone off.
- SSO connections: Google on (Clerk's shared development credentials are fine).
- Web3: MetaMask and Base on.
- Client Trust off; sign-up mode public; organizations not required.

A field marked "required at sign-up" would leave the sign-up waiting for it
after the code and block the session.

Not in this step: the Neon database, light mode, the custom domain, the
project list and templates on `/studio`.

## Step 3: Ostium behind a venue layer

`lib/venues/types.ts` is the `Venue` interface; `lib/venues/ostium.ts` is
the only file that imports the SDK. Reads go through the read-only client,
trades through the build-only methods that return unsigned transactions.
`lib/chainlink/` reads the mainnet price feeds as the independent check,
`lib/risk/check.ts` is the pure risk checker, and `/internal/ostium` (email
allowlist, off the nav) shows markets, prices next to Chainlink, a preview
through the checker and testnet test trades. `OSTIUM_TESTNET=true` by default.

## Step 4: database, strategy and first backtest

- Neon Postgres, the `studio` schema, through `lib/db.ts` (the same
  `neon()` client as canhav.dev). `scripts/db-setup.mjs` creates the tables
  and is safe to rerun: `npm run db:setup` reads `DATABASE_URL` from
  `.env.local`. Use a dev branch's pooled URL locally; production gets its
  own branch in the Vercel env.
- `lib/strategies/spec.ts` is the one validated strategy object; long only
  for now, with `direction` stored so shorts can follow. One entry rule
  (MA cross, RSI, breakout), exits on the opposite signal plus optional take
  profit and stop loss, size, caps, tier, status, and a daily candle-close
  wake trigger.
- `lib/strategies/backtest.ts` is the pure engine on daily candles with the
  step 3 costs and the risk checker on every simulated open;
  `lib/strategies/candles.ts` is the first `CandleSource`, Ostium's own
  daily candles (history from 2024-01-01 for crypto, later for newer
  markets). Every result shows where its history starts.
- `/studio` is a trader's dashboard (step 4b): an account strip, the
  strategies table with return, drawdown, open position, last signal and
  next check, an activity feed from each strategy's latest backtest, and
  for an empty account the headline markets with three templates.
- `/studio/strategies/new` and `/studio/strategies/[id]` are one
  workspace: markets rail, Lightweight Charts with the rule drawn and the
  backtest's trades marked, a strategy panel with a leverage slider capped
  at the tightest limit, and Performance, Trades and Costs tabs. Every
  change re-runs the engine in the browser; Save runs it on the server and
  stores the result. Allowlist only while this is internal.

## Step 5 and 5b: paper trading and fixes

- Paper trading on live Ostium prices with the same engine, checker and
  cost model: `lib/paper/` (pure engine and runner, a Neon store, a memory
  store for tests), a tick endpoint at `/api/internal/paper/tick` that
  Vercel's cron calls every five minutes with `CRON_SECRET`, and Start and
  Stop in the workspace. Each run is keyed by strategy and candle date.
- Backtests and paper stop when equity falls below Ostium's $5 minimum
  collateral: the strategy is labelled blown out and returns stop at −100%.
- Market data (pairs, prices, candles, fees, rollover) always comes from
  Arbitrum One; `OSTIUM_TESTNET` only decides where trades are built and
  signed.
- Market names: a toggle at the top of the markets list between simple
  names (NVDA · NVIDIA, Gold, S&P 500) and Ostium pair symbols, saved on
  the Clerk user. Every market is a synthetic perpetual.

## Step 6: MCP, so an agent can design and test strategies

- Two MCP servers on the official SDK's streamable HTTP transport: the
  account server at `/mcp` (markets, candles, backtests, drafts, the feed)
  and one per strategy at `/mcp/s/<id>` (its spec, backtest, paper results,
  positions, proposals and paper requests). Sign-in is Clerk OAuth: enable
  "Publish DCR support" and "Publish CIMD support" under OAuth
  applications → Settings → Client onboarding, and set `NEXT_PUBLIC_APP_URL`
  to the deployment so the metadata names the right resource.
- Agents can read, backtest and propose. `propose_change` and the paper
  requests store a pending proposal; the strategy page shows it with the
  diff and its backtest beside the current one, and only Accept there
  applies it. Decisions land in the feed tagged agent.
- A Connect card on the dashboard and each strategy page gives one command
  or link per client (Claude Code, Claude, Cursor, VS Code, Codex, ChatGPT)
  and shows who is connected.

## Step 7: live trading through wallet permissions (testnet only)

- Step 0 found that MetaMask's ERC-7715 permissions are token-spend only
  (ERC-20 and native allowance, periodic and stream; MetaMask 13.23.0+,
  Arbitrum Sepolia supported), so they cannot scope Ostium calls or keep
  positions in the user's account. Live trading uses Ostium's own
  delegation instead: the wallet approves exactly the agreed USDC total to
  Trading Storage and registers a per-wallet session account as its
  delegate; the session trades through `delegatedAction`, so positions and
  USDC stay in the wallet and closes pay the wallet. Revoking in MetaMask
  (remove delegate, or approval to 0) stops every strategy on that wallet.
- Session keys are secp256k1 keys in AWS KMS (`AWS_REGION`,
  `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`); signing happens inside KMS
  and nothing in Studio ever holds or returns a key. One session per wallet
  serves every live strategy on it; the key is disabled and scheduled for
  deletion when the last one stops. Gas is a small Sepolia ETH top-up from
  the dev wallet (`LIVE_GAS_TOPUP_ETH`); Ostium's sponsored path needs a
  Safe delegate and their builder API, so there is no paymaster in this mode.
- The Go-live card on a strategy page: connect the wallet, read the terms
  (trade size and leverage, daily stop, total approval shown as trades,
  expiry, the contracts allowed), confirm two MetaMask transactions. Live
  strategies ride the paper tick: the checker runs again right before each
  order is built (now counting the wallet's exposure in that market for the
  open-interest share), take profit and stop loss go on the Ostium trade
  itself, every order is recorded before it is sent and matched to its fill
  by order id, and positions are read from the chain, never stored.
- Controls: Pause (no entries, positions stay), Close all (works while
  paused), Stop (close, end, destroy the key when the wallet has no other
  live strategy), Revoke in MetaMask. A revoked or expired permission marks
  the strategy "permission ended" with one row in the feed and nothing more
  is sent. Live mode refuses to run unless `OSTIUM_TESTNET=true` and KMS is
  configured; MCP tools are unchanged.

## Run

```bash
npm install
npm run dev
```

`DUNE_API_KEY` is optional (see `.env.example`).
