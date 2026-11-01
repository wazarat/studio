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

const tables = await sql`
  select table_name from information_schema.tables
  where table_schema = 'studio' order by table_name`;
console.log("studio tables:", tables.map((t) => t.table_name).join(", "));
