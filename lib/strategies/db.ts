import "server-only";

import { getDb } from "@/lib/db";
import type { BacktestResult } from "@/lib/strategies/backtest";
import { StrategySpecSchema, type StrategySpec } from "@/lib/strategies/spec";

/**
 * Strategies, backtests and daily results in Neon (Studio step 4), in the
 * `studio` schema. Ownership is the Clerk user id in `owner_id`, written
 * into every scoped query. Rows are mapped by hand, as canhav.dev does;
 * numeric columns come back as strings and are converted here.
 */

export interface StrategyRow {
  id: string;
  ownerId: string;
  name: string;
  symbol: string;
  marketId: string;
  status: StrategySpec["status"];
  tier: StrategySpec["tier"];
  spec: StrategySpec;
  /** ms epoch when paper trading started; null when never started. */
  paperSince: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface BacktestRow {
  id: string;
  strategyId: string;
  historyStart: string;
  createdAt: string;
  inputs: BacktestInputs;
  results: BacktestResult;
}

/** What a backtest was run with, stored beside its results. */
export interface BacktestInputs {
  spec: StrategySpec;
  market: unknown;
  source: string;
  candleCount: number;
  windowStart: number;
  windowEnd: number;
  ranAt: number;
}

function toStrategy(r: Record<string, unknown>): StrategyRow {
  return {
    id: String(r.id),
    ownerId: String(r.owner_id),
    name: String(r.name),
    symbol: String(r.symbol),
    marketId: String(r.market_id),
    status: r.status as StrategySpec["status"],
    tier: r.tier as StrategySpec["tier"],
    spec: StrategySpecSchema.parse(r.spec),
    paperSince: r.paper_since ? new Date(r.paper_since as string).getTime() : null,
    createdAt: new Date(r.created_at as string).toISOString(),
    updatedAt: new Date(r.updated_at as string).toISOString(),
  };
}

function toBacktest(r: Record<string, unknown>): BacktestRow {
  return {
    id: String(r.id),
    strategyId: String(r.strategy_id),
    historyStart: new Date(r.history_start as string).toISOString(),
    createdAt: new Date(r.created_at as string).toISOString(),
    inputs: r.inputs as BacktestInputs,
    results: r.results as BacktestResult,
  };
}

export function storageConfigured(): boolean {
  return getDb() !== null;
}

export async function listStrategies(ownerId: string): Promise<StrategyRow[]> {
  const sql = getDb();
  if (!sql) return [];
  const rows = await sql`
    select * from studio.strategies where owner_id = ${ownerId} order by updated_at desc`;
  return rows.map(toStrategy);
}

export async function getStrategy(id: string, ownerId: string): Promise<StrategyRow | null> {
  const sql = getDb();
  if (!sql) return null;
  const rows = await sql`
    select * from studio.strategies where id = ${id} and owner_id = ${ownerId}`;
  return rows[0] ? toStrategy(rows[0]) : null;
}

export async function insertStrategy(ownerId: string, spec: StrategySpec): Promise<StrategyRow> {
  const sql = getDb();
  if (!sql) throw new Error("Storage not configured");
  const rows = await sql`
    insert into studio.strategies (id, owner_id, name, venue, market_id, symbol, spec, status, tier)
    values (${spec.id}, ${ownerId}, ${spec.name}, ${spec.market.venue}, ${spec.market.marketId}, ${spec.market.symbol},
            ${JSON.stringify(spec)}, ${spec.status}, ${spec.tier})
    returning *`;
  return toStrategy(rows[0]);
}

export async function updateStrategy(ownerId: string, spec: StrategySpec): Promise<StrategyRow | null> {
  const sql = getDb();
  if (!sql) throw new Error("Storage not configured");
  const rows = await sql`
    update studio.strategies
    set name = ${spec.name}, market_id = ${spec.market.marketId}, symbol = ${spec.market.symbol},
        spec = ${JSON.stringify(spec)}, status = ${spec.status}, tier = ${spec.tier}, updated_at = now()
    where id = ${spec.id} and owner_id = ${ownerId}
    returning *`;
  return rows[0] ? toStrategy(rows[0]) : null;
}

export async function insertBacktest(strategyId: string, inputs: BacktestInputs, results: BacktestResult): Promise<BacktestRow> {
  const sql = getDb();
  if (!sql) throw new Error("Storage not configured");
  const rows = await sql`
    insert into studio.backtests (strategy_id, inputs, results, history_start)
    values (${strategyId}, ${JSON.stringify(inputs)}, ${JSON.stringify(results)}, ${new Date(results.historyStart).toISOString()})
    returning *`;
  await sql`update studio.strategies set updated_at = now() where id = ${strategyId}`;
  return toBacktest(rows[0]);
}

export async function latestBacktest(strategyId: string): Promise<BacktestRow | null> {
  const sql = getDb();
  if (!sql) return null;
  const rows = await sql`
    select * from studio.backtests where strategy_id = ${strategyId} order by created_at desc limit 1`;
  return rows[0] ? toBacktest(rows[0]) : null;
}

/** Latest backtest per strategy, for the list. */
export async function latestBacktests(strategyIds: string[]): Promise<Map<string, BacktestRow>> {
  const sql = getDb();
  const out = new Map<string, BacktestRow>();
  if (!sql || strategyIds.length === 0) return out;
  const rows = await sql`
    select distinct on (strategy_id) * from studio.backtests
    where strategy_id = any(${strategyIds}::uuid[])
    order by strategy_id, created_at desc`;
  for (const r of rows) {
    const b = toBacktest(r);
    out.set(b.strategyId, b);
  }
  return out;
}

/** Realised loss today (UTC) for the loss stop; 0 until paper or live trading writes rows. */
export async function lossTodayUsd(strategyId: string, day?: string): Promise<number> {
  const sql = getDb();
  if (!sql) return 0;
  const rows = day
    ? await sql`select realised_pnl_usd from studio.daily_results where strategy_id = ${strategyId} and day = ${day}::date`
    : await sql`
        select realised_pnl_usd from studio.daily_results
        where strategy_id = ${strategyId} and day = (now() at time zone 'utc')::date`;
  const pnl = rows[0] ? Number(rows[0].realised_pnl_usd) : 0;
  return pnl < 0 ? -pnl : 0;
}
