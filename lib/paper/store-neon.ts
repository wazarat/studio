import "server-only";

import { getDb } from "@/lib/db";
import { dateFromDb } from "@/lib/paper/engine";
import type { ActivityRow, CloseFields, NewActivity, NewPosition, PaperPosition, PaperStore, PaperStrategy, RunOutcome } from "@/lib/paper/store";
import { StrategySpecSchema } from "@/lib/strategies/spec";

/**
 * The Neon PaperStore (Studio step 5). Every method is one guarded
 * statement so a retried tick cannot trade twice: run claims win on the
 * primary key, opens on the partial unique index, closes on
 * `closed_at is null`, rollover on compare-and-set, activity on its
 * dedupe key. The balance is derived from closed positions.
 */

const num = (v: unknown): number => (v === null || v === undefined ? 0 : Number(v));
const opt = (v: unknown): number | undefined => (v === null || v === undefined ? undefined : Number(v));
const ms = (v: unknown): number => new Date(v as string).getTime();
const dateStr = dateFromDb;

export function toPaperPosition(r: Record<string, unknown>): PaperPosition {
  return {
    id: String(r.id),
    strategyId: String(r.strategy_id),
    ownerId: String(r.owner_id),
    marketId: String(r.market_id),
    symbol: String(r.symbol),
    entryPrice: num(r.entry_price),
    notionalUsd: num(r.notional_usd),
    collateralUsd: num(r.collateral_usd),
    leverage: num(r.leverage),
    liquidationPrice: num(r.liquidation_price),
    takeProfit: opt(r.take_profit),
    stopLoss: opt(r.stop_loss),
    openFeeUsd: num(r.open_fee_usd),
    oracleFeeUsd: num(r.oracle_fee_usd),
    rolloverPerDayUsd: num(r.rollover_per_day_usd),
    rolloverUsd: num(r.rollover_usd),
    daysHeld: num(r.days_held),
    rolloverThrough: dateStr(r.rollover_through),
    entryCandleDate: dateStr(r.entry_candle_date),
    openedAt: ms(r.opened_at),
    closedAt: r.closed_at ? ms(r.closed_at) : null,
    closeReason: (r.close_reason as PaperPosition["closeReason"]) ?? undefined,
    exitPrice: opt(r.exit_price),
    pricePnlUsd: opt(r.price_pnl_usd),
    feesUsd: opt(r.fees_usd),
    realisedPnlUsd: opt(r.realised_pnl_usd),
  };
}

export function toActivityRow(r: Record<string, unknown>): ActivityRow {
  return {
    id: String(r.id),
    strategyId: String(r.strategy_id),
    ownerId: String(r.owner_id),
    mode: r.mode === "agent" ? "agent" : r.mode === "live" ? "live" : "paper",
    kind: r.kind as ActivityRow["kind"],
    positionId: r.position_id ? String(r.position_id) : undefined,
    candleDate: r.candle_date ? dateStr(r.candle_date) : undefined,
    price: opt(r.price),
    sizeUsd: opt(r.size_usd),
    feesUsd: opt(r.fees_usd),
    pnlUsd: opt(r.pnl_usd),
    reason: String(r.reason ?? ""),
    meta: (r.meta as Record<string, unknown>) ?? undefined,
    dedupeKey: r.dedupe_key ? String(r.dedupe_key) : undefined,
    time: ms(r.time),
  };
}

function sqlOrThrow() {
  const sql = getDb();
  if (!sql) throw new Error("Storage not configured");
  return sql;
}

export const neonPaperStore: PaperStore = {
  async paperStrategies(): Promise<PaperStrategy[]> {
    const sql = sqlOrThrow();
    const rows = await sql`
      select s.* from studio.strategies s
      where s.status = 'paper'
         or exists (select 1 from studio.paper_positions p where p.strategy_id = s.id and p.closed_at is null)`;
    return rows.map((r) => ({
      id: String(r.id),
      ownerId: String(r.owner_id),
      name: String(r.name),
      symbol: String(r.symbol),
      marketId: String(r.market_id),
      status: r.status as PaperStrategy["status"],
      spec: StrategySpecSchema.parse(r.spec),
      paperSince: r.paper_since ? ms(r.paper_since) : null,
      blownOutAt: r.blown_out_at ? ms(r.blown_out_at) : null,
    }));
  },

  async openPositions() {
    const sql = sqlOrThrow();
    const rows = await sql`select * from studio.paper_positions where closed_at is null order by opened_at`;
    return rows.map(toPaperPosition);
  },

  async finishedRuns(ids, candleDate) {
    if (ids.length === 0) return new Set();
    const sql = sqlOrThrow();
    const rows = await sql`
      select strategy_id from studio.paper_runs
      where candle_date = ${candleDate}::date and finished_at is not null and strategy_id = any(${ids}::uuid[])`;
    return new Set(rows.map((r) => String(r.strategy_id)));
  },

  async claimRun(strategyId, candleDate, nowMs) {
    const sql = sqlOrThrow();
    const rows = await sql`
      insert into studio.paper_runs (strategy_id, candle_date, started_at)
      values (${strategyId}, ${candleDate}::date, ${new Date(nowMs).toISOString()})
      on conflict (strategy_id, candle_date) do update set started_at = excluded.started_at
        where studio.paper_runs.finished_at is null and studio.paper_runs.started_at < excluded.started_at - interval '10 minutes'
      returning strategy_id`;
    return rows.length > 0;
  },

  async finishRun(strategyId, candleDate, outcome: RunOutcome, note) {
    const sql = sqlOrThrow();
    await sql`
      update studio.paper_runs set finished_at = now(), outcome = ${outcome}, note = ${note ?? null}
      where strategy_id = ${strategyId} and candle_date = ${candleDate}::date`;
  },

  async openPosition(p: NewPosition) {
    const sql = sqlOrThrow();
    try {
      const rows = await sql`
        insert into studio.paper_positions (
          strategy_id, owner_id, market_id, symbol, entry_price, notional_usd, collateral_usd, leverage, liquidation_price,
          take_profit, stop_loss, open_fee_usd, oracle_fee_usd, rollover_per_day_usd, rollover_usd, rollover_through, days_held,
          entry_candle_date, opened_at)
        values (
          ${p.strategyId}, ${p.ownerId}, ${p.marketId}, ${p.symbol}, ${p.entryPrice}, ${p.notionalUsd}, ${p.collateralUsd}, ${p.leverage}, ${p.liquidationPrice},
          ${p.takeProfit ?? null}, ${p.stopLoss ?? null}, ${p.openFeeUsd}, ${p.oracleFeeUsd}, ${p.rolloverPerDayUsd}, ${p.rolloverUsd}, ${p.rolloverThrough}::date, ${p.daysHeld},
          ${p.entryCandleDate}::date, ${new Date(p.openedAt).toISOString()})
        returning *`;
      return toPaperPosition(rows[0]);
    } catch (error) {
      if (error instanceof Error && /23505|duplicate key|paper_positions_one_open_idx/.test(error.message)) return null;
      throw error;
    }
  },

  async accrueRollover(id, from, to, days, chargeUsd) {
    const sql = sqlOrThrow();
    const rows = await sql`
      update studio.paper_positions
      set rollover_usd = rollover_usd + ${chargeUsd}, days_held = days_held + ${days}, rollover_through = ${to}::date
      where id = ${id} and closed_at is null and rollover_through = ${from}::date
      returning id`;
    return rows.length > 0;
  },

  async closePosition(id, c: CloseFields) {
    const sql = sqlOrThrow();
    const rows = await sql`
      update studio.paper_positions
      set closed_at = ${new Date(c.closedAt).toISOString()}, close_reason = ${c.reason}, exit_price = ${c.exitPrice},
          price_pnl_usd = ${c.pricePnlUsd}, fees_usd = ${c.feesUsd}, realised_pnl_usd = ${c.realisedPnlUsd}
      where id = ${id} and closed_at is null
      returning *`;
    return rows[0] ? toPaperPosition(rows[0]) : null;
  },

  async recordActivity(a: NewActivity) {
    const sql = sqlOrThrow();
    await sql`
      insert into studio.activity (strategy_id, owner_id, mode, kind, position_id, candle_date, price, size_usd, fees_usd, pnl_usd, reason, meta, dedupe_key, time)
      values (${a.strategyId}, ${a.ownerId}, ${a.mode}, ${a.kind}, ${a.positionId ?? null}, ${a.candleDate ?? null}, ${a.price ?? null}, ${a.sizeUsd ?? null},
              ${a.feesUsd ?? null}, ${a.pnlUsd ?? null}, ${a.reason}, ${a.meta ? JSON.stringify(a.meta) : null}, ${a.dedupeKey ?? null}, ${new Date(a.time).toISOString()})
      on conflict (strategy_id, dedupe_key) where dedupe_key is not null do nothing`;
  },

  async lossForDay(strategyId, day) {
    const sql = sqlOrThrow();
    const rows = await sql`
      select coalesce(sum(realised_pnl_usd), 0) as pnl from studio.paper_positions
      where strategy_id = ${strategyId} and closed_at is not null and (closed_at at time zone 'utc')::date = ${day}::date`;
    const pnl = num(rows[0]?.pnl);
    return pnl < 0 ? -pnl : 0;
  },

  async upsertDailyResult(strategyId, day) {
    const sql = sqlOrThrow();
    await sql`
      insert into studio.daily_results (strategy_id, day, realised_pnl_usd, fees_usd, trades, updated_at)
      select ${strategyId}, ${day}::date, coalesce(sum(realised_pnl_usd), 0), coalesce(sum(fees_usd), 0), count(*), now()
      from studio.paper_positions
      where strategy_id = ${strategyId} and closed_at is not null and (closed_at at time zone 'utc')::date = ${day}::date
      on conflict (strategy_id, day) do update
        set realised_pnl_usd = excluded.realised_pnl_usd, fees_usd = excluded.fees_usd, trades = excluded.trades, updated_at = now()`;
  },

  async realisedSince(strategyId, sinceMs) {
    const sql = sqlOrThrow();
    const rows = await sql`
      select coalesce(sum(realised_pnl_usd), 0) as pnl from studio.paper_positions
      where strategy_id = ${strategyId} and closed_at is not null and opened_at >= ${new Date(sinceMs).toISOString()}`;
    return num(rows[0]?.pnl);
  },

  async markBlownOut(strategyId, nowMs) {
    const sql = sqlOrThrow();
    await sql`
      update studio.strategies
      set status = 'draft', spec = jsonb_set(spec, '{status}', '"draft"'), blown_out_at = ${new Date(nowMs).toISOString()}, updated_at = now()
      where id = ${strategyId}`;
  },

  async availableCollateral(ownerId) {
    const sql = sqlOrThrow();
    const rows = await sql`
      select
        coalesce((select starting_balance_usd from studio.paper_accounts where owner_id = ${ownerId}), 10000) as starting,
        coalesce((select sum(realised_pnl_usd) from studio.paper_positions where owner_id = ${ownerId} and closed_at is not null), 0) as realised,
        coalesce((select sum(collateral_usd) from studio.paper_positions where owner_id = ${ownerId} and closed_at is null), 0) as open_collateral`;
    const r = rows[0];
    return num(r.starting) + num(r.realised) - num(r.open_collateral);
  },
};

/** Extra reads for the pages, not part of the runner's store. */
export async function ensurePaperAccount(ownerId: string): Promise<void> {
  const sql = sqlOrThrow();
  await sql`insert into studio.paper_accounts (owner_id) values (${ownerId}) on conflict (owner_id) do nothing`;
}

export async function paperActivityFor(ownerId: string, strategyId: string | null, limit = 50): Promise<ActivityRow[]> {
  const sql = getDb();
  if (!sql) return [];
  const rows = strategyId
    ? await sql`select * from studio.activity where owner_id = ${ownerId} and strategy_id = ${strategyId} order by time desc limit ${limit}`
    : await sql`select * from studio.activity where owner_id = ${ownerId} order by time desc limit ${limit}`;
  return rows.map(toActivityRow);
}

export async function paperPositionsFor(ownerId: string, strategyId?: string): Promise<PaperPosition[]> {
  const sql = getDb();
  if (!sql) return [];
  const rows = strategyId
    ? await sql`select * from studio.paper_positions where owner_id = ${ownerId} and strategy_id = ${strategyId} order by opened_at desc`
    : await sql`select * from studio.paper_positions where owner_id = ${ownerId} order by opened_at desc`;
  return rows.map(toPaperPosition);
}

export async function paperAccountFor(ownerId: string): Promise<{ startingUsd: number; realisedUsd: number; realisedTodayUsd: number }> {
  const sql = getDb();
  if (!sql) return { startingUsd: 10_000, realisedUsd: 0, realisedTodayUsd: 0 };
  const rows = await sql`
    select
      coalesce((select starting_balance_usd from studio.paper_accounts where owner_id = ${ownerId}), 10000) as starting,
      coalesce((select sum(realised_pnl_usd) from studio.paper_positions where owner_id = ${ownerId} and closed_at is not null), 0) as realised,
      coalesce((select sum(realised_pnl_usd) from studio.paper_positions where owner_id = ${ownerId} and closed_at is not null
                and (closed_at at time zone 'utc')::date = (now() at time zone 'utc')::date), 0) as realised_today`;
  const r = rows[0];
  return { startingUsd: num(r.starting), realisedUsd: num(r.realised), realisedTodayUsd: num(r.realised_today) };
}

export async function setStrategyStatus(ownerId: string, id: string, status: "paper" | "draft", from: "paper" | "draft"): Promise<boolean> {
  const sql = sqlOrThrow();
  const rows =
    status === "paper"
      ? await sql`
          update studio.strategies
          set status = 'paper', spec = jsonb_set(spec, '{status}', '"paper"'), paper_since = now(), blown_out_at = null, updated_at = now()
          where id = ${id} and owner_id = ${ownerId} and status = ${from}
          returning id`
      : await sql`
          update studio.strategies
          set status = 'draft', spec = jsonb_set(spec, '{status}', '"draft"'), updated_at = now()
          where id = ${id} and owner_id = ${ownerId} and status = ${from}
          returning id`;
  return rows.length > 0;
}
