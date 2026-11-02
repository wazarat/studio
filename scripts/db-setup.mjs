// Studio's tables (step 4). Idempotent and append-only, like canhav.dev's
// scripts/db-setup.mjs: run it against each Neon branch once, and again
// after every schema change here.
//
//   npm run db:setup            (reads .env.local)
import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}
const sql = neon(url);

await sql`create schema if not exists studio`;

await sql`
  create table if not exists studio.strategies (
    id uuid primary key default gen_random_uuid(),
    owner_id text not null,
    name text not null,
    venue text not null default 'ostium',
    market_id text not null,
    symbol text not null,
    spec jsonb not null,
    status text not null default 'draft' check (status in ('draft', 'paper', 'live')),
    tier text not null check (tier in ('studio', 'studio-plus')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  )`;
await sql`create index if not exists strategies_owner_idx on studio.strategies (owner_id, updated_at desc)`;

await sql`
  create table if not exists studio.backtests (
    id uuid primary key default gen_random_uuid(),
    strategy_id uuid not null references studio.strategies(id) on delete cascade,
    inputs jsonb not null,
    results jsonb not null,
    history_start timestamptz not null,
    created_at timestamptz not null default now()
  )`;
await sql`create index if not exists backtests_strategy_idx on studio.backtests (strategy_id, created_at desc)`;

await sql`
  create table if not exists studio.daily_results (
    strategy_id uuid not null references studio.strategies(id) on delete cascade,
    day date not null,
    realised_pnl_usd numeric not null default 0,
    fees_usd numeric not null default 0,
    trades integer not null default 0,
    updated_at timestamptz not null default now(),
    primary key (strategy_id, day)
  )`;

// Paper trading (step 5).
await sql`alter table studio.strategies add column if not exists paper_since timestamptz`;

await sql`
  create table if not exists studio.paper_accounts (
    owner_id text primary key,
    starting_balance_usd numeric not null default 10000,
    created_at timestamptz not null default now()
  )`;

await sql`
  create table if not exists studio.paper_positions (
    id uuid primary key default gen_random_uuid(),
    strategy_id uuid not null references studio.strategies(id) on delete cascade,
    owner_id text not null,
    market_id text not null,
    symbol text not null,
    side text not null default 'long' check (side in ('long', 'short')),
    entry_price numeric not null,
    notional_usd numeric not null,
    collateral_usd numeric not null,
    leverage numeric not null,
    liquidation_price numeric not null,
    take_profit numeric,
    stop_loss numeric,
    open_fee_usd numeric not null,
    oracle_fee_usd numeric not null,
    rollover_per_day_usd numeric not null,
    rollover_usd numeric not null default 0,
    rollover_through date not null,
    days_held integer not null default 0,
    entry_candle_date date not null,
    opened_at timestamptz not null default now(),
    closed_at timestamptz,
    close_reason text check (close_reason in ('signal', 'take-profit', 'stop-loss', 'liquidation', 'stopped')),
    exit_price numeric,
    price_pnl_usd numeric,
    fees_usd numeric,
    realised_pnl_usd numeric,
    check ((closed_at is null) = (close_reason is null))
  )`;
await sql`create unique index if not exists paper_positions_one_open_idx on studio.paper_positions (strategy_id) where closed_at is null`;
await sql`create index if not exists paper_positions_owner_open_idx on studio.paper_positions (owner_id) where closed_at is null`;
await sql`create index if not exists paper_positions_strategy_idx on studio.paper_positions (strategy_id, opened_at desc)`;

await sql`
  create table if not exists studio.paper_runs (
    strategy_id uuid not null references studio.strategies(id) on delete cascade,
    candle_date date not null,
    started_at timestamptz not null default now(),
    finished_at timestamptz,
    outcome text check (outcome in ('hold', 'entered', 'exited', 'refused')),
    note text,
    primary key (strategy_id, candle_date)
  )`;

await sql`
  create table if not exists studio.activity (
    id uuid primary key default gen_random_uuid(),
    strategy_id uuid not null references studio.strategies(id) on delete cascade,
    owner_id text not null,
    mode text not null check (mode in ('backtest', 'paper')),
    kind text not null check (kind in ('signal', 'fill', 'refusal', 'close', 'skip')),
    position_id uuid references studio.paper_positions(id) on delete set null,
    candle_date date,
    price numeric,
    size_usd numeric,
    fees_usd numeric,
    pnl_usd numeric,
    reason text,
    meta jsonb,
    dedupe_key text,
    time timestamptz not null default now()
  )`;
await sql`create index if not exists activity_strategy_time_idx on studio.activity (strategy_id, time desc)`;
await sql`create index if not exists activity_owner_time_idx on studio.activity (owner_id, time desc)`;
await sql`create unique index if not exists activity_dedupe_idx on studio.activity (strategy_id, dedupe_key) where dedupe_key is not null`;

// Step 5b: blow-out stop.
await sql`alter table studio.strategies add column if not exists blown_out_at timestamptz`;
await sql`alter table studio.paper_positions drop constraint if exists paper_positions_close_reason_check`;
await sql`alter table studio.paper_positions add constraint paper_positions_close_reason_check
  check (close_reason in ('signal', 'take-profit', 'stop-loss', 'liquidation', 'stopped', 'blown-out'))`;


// Step 6: agent proposals and MCP connections.
await sql`
  create table if not exists studio.proposals (
    id uuid primary key default gen_random_uuid(),
    strategy_id uuid not null references studio.strategies(id) on delete cascade,
    owner_id text not null,
    kind text not null check (kind in ('change', 'paper-start', 'paper-stop')),
    proposed_spec jsonb,
    reason text not null,
    backtest jsonb,
    client_id text,
    client_name text,
    status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected', 'withdrawn')),
    created_at timestamptz not null default now(),
    decided_at timestamptz
  )`;
await sql`create index if not exists proposals_strategy_idx on studio.proposals (strategy_id, created_at desc)`;
await sql`create index if not exists proposals_pending_idx on studio.proposals (strategy_id) where status = 'pending'`;

await sql`
  create table if not exists studio.mcp_connections (
    owner_id text not null,
    client_id text not null,
    client_name text,
    server text not null,
    first_seen_at timestamptz not null default now(),
    last_seen_at timestamptz not null default now(),
    calls integer not null default 0,
    primary key (owner_id, client_id, server)
  )`;

await sql`alter table studio.activity drop constraint if exists activity_mode_check`;
await sql`alter table studio.activity add constraint activity_mode_check check (mode in ('backtest', 'paper', 'agent'))`;
await sql`alter table studio.activity drop constraint if exists activity_kind_check`;
await sql`alter table studio.activity add constraint activity_kind_check check (kind in ('signal', 'fill', 'refusal', 'close', 'skip', 'proposal'))`;

// Step 7: live trading through Ostium delegation (testnet only). One session
// key per wallet, a link per strategy, and every order the session sent.
await sql`
  create table if not exists studio.wallet_sessions (
    id uuid primary key default gen_random_uuid(),
    owner_id text not null,
    trader_address text not null,
    session_address text not null,
    kms_key_id text not null,
    status text not null default 'pending' check (status in ('pending', 'active', 'permission-ended', 'ended')),
    expires_at timestamptz,
    approve_tx text,
    delegate_tx text,
    gas_topup_tx text,
    last_delegate_check timestamptz,
    allowance_usd numeric not null default 0,
    created_at timestamptz not null default now(),
    activated_at timestamptz,
    ended_at timestamptz,
    ended_reason text
  )`;
await sql`create unique index if not exists wallet_sessions_open_idx on studio.wallet_sessions (owner_id, lower(trader_address))
  where status in ('pending', 'active', 'permission-ended')`;

await sql`
  create table if not exists studio.live_strategies (
    strategy_id uuid primary key references studio.strategies(id) on delete cascade,
    session_id uuid not null references studio.wallet_sessions(id) on delete cascade,
    owner_id text not null,
    status text not null default 'active' check (status in ('active', 'paused', 'closing', 'permission-ended', 'ended')),
    total_cap_usd numeric not null,
    spent_usd numeric not null default 0,
    started_at timestamptz not null default now(),
    ended_at timestamptz,
    ended_reason text
  )`;
await sql`create index if not exists live_strategies_session_idx on studio.live_strategies (session_id)`;

await sql`
  create table if not exists studio.live_orders (
    id uuid primary key default gen_random_uuid(),
    strategy_id uuid not null references studio.strategies(id) on delete cascade,
    session_id uuid not null references studio.wallet_sessions(id) on delete cascade,
    owner_id text not null,
    kind text not null check (kind in ('open', 'close')),
    ref text not null,
    market_id text not null,
    symbol text not null,
    candle_date date,
    collateral_usd numeric,
    leverage numeric,
    take_profit numeric,
    stop_loss numeric,
    tx_hash text,
    oid text,
    pid text,
    position_index integer,
    status text not null default 'building' check (status in ('building', 'submitted', 'filled', 'cancelled', 'failed')),
    fill_price numeric,
    fill_pnl_usd numeric,
    fill_fees_usd numeric,
    closed_at timestamptz,
    close_reason text,
    close_pnl_usd numeric,
    error text,
    reason text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (strategy_id, kind, ref)
  )`;
await sql`create index if not exists live_orders_strategy_idx on studio.live_orders (strategy_id, created_at desc)`;
await sql`create index if not exists live_orders_pending_idx on studio.live_orders (session_id) where status in ('building', 'submitted')`;

await sql`alter table studio.activity drop constraint if exists activity_mode_check`;
await sql`alter table studio.activity add constraint activity_mode_check check (mode in ('backtest', 'paper', 'agent', 'live'))`;

const tables = await sql`
  select table_name from information_schema.tables
  where table_schema = 'studio' order by table_name`;
console.log("studio tables:", tables.map((t) => t.table_name).join(", "));
