import "server-only";

import type { Hex } from "viem";

import { getDb } from "@/lib/db";
import type { LiveLink, LiveOrder, LiveStore, NewOrder, NewSession, OrderPatch, WalletSession } from "@/lib/live/store";
import { dateFromDb } from "@/lib/paper/engine";
import type { LiveStrategy } from "@/lib/paper/store";
import { StrategySpecSchema } from "@/lib/strategies/spec";

/**
 * The Neon LiveStore (Studio step 7). Status changes are compare-and-set,
 * orders win on their unique key, and nothing here ever sees a private
 * key: the session row holds only the KMS key id and the address.
 */

const num = (v: unknown): number => (v === null || v === undefined ? 0 : Number(v));
const opt = (v: unknown): number | undefined => (v === null || v === undefined ? undefined : Number(v));
const ms = (v: unknown): number => new Date(v as string).getTime();
const msOrNull = (v: unknown): number | null => (v ? ms(v) : null);
const iso = (n: number) => new Date(n).toISOString();

function sqlOrThrow() {
  const sql = getDb();
  if (!sql) throw new Error("Storage not configured");
  return sql;
}

export function toSession(r: Record<string, unknown>): WalletSession {
  return {
    id: String(r.id),
    ownerId: String(r.owner_id),
    trader: String(r.trader_address) as Hex,
    sessionAddress: String(r.session_address) as Hex,
    kmsKeyId: String(r.kms_key_id),
    status: r.status as WalletSession["status"],
    expiresAt: msOrNull(r.expires_at),
    approveTx: r.approve_tx ? String(r.approve_tx) : undefined,
    delegateTx: r.delegate_tx ? String(r.delegate_tx) : undefined,
    gasTopupTx: r.gas_topup_tx ? String(r.gas_topup_tx) : undefined,
    lastDelegateCheck: msOrNull(r.last_delegate_check),
    allowanceUsd: num(r.allowance_usd),
    createdAt: ms(r.created_at),
    activatedAt: msOrNull(r.activated_at),
    endedAt: msOrNull(r.ended_at),
    endedReason: r.ended_reason ? String(r.ended_reason) : undefined,
  };
}

export function toLink(r: Record<string, unknown>): LiveLink {
  return {
    strategyId: String(r.strategy_id),
    sessionId: String(r.session_id),
    ownerId: String(r.owner_id),
    status: r.status as LiveLink["status"],
    totalCapUsd: num(r.total_cap_usd),
    spentUsd: num(r.spent_usd),
    startedAt: ms(r.started_at),
    endedAt: msOrNull(r.ended_at),
    endedReason: r.ended_reason ? String(r.ended_reason) : undefined,
  };
}

export function toOrder(r: Record<string, unknown>): LiveOrder {
  return {
    id: String(r.id),
    strategyId: String(r.strategy_id),
    sessionId: String(r.session_id),
    ownerId: String(r.owner_id),
    kind: r.kind as LiveOrder["kind"],
    ref: String(r.ref),
    marketId: String(r.market_id),
    symbol: String(r.symbol),
    candleDate: r.candle_date ? dateFromDb(r.candle_date) : undefined,
    collateralUsd: opt(r.collateral_usd),
    leverage: opt(r.leverage),
    takeProfit: opt(r.take_profit),
    stopLoss: opt(r.stop_loss),
    txHash: r.tx_hash ? (String(r.tx_hash) as Hex) : undefined,
    oid: r.oid ? String(r.oid) : undefined,
    pid: r.pid ? String(r.pid) : undefined,
    positionIndex: opt(r.position_index),
    status: r.status as LiveOrder["status"],
    fillPrice: opt(r.fill_price),
    fillPnlUsd: opt(r.fill_pnl_usd),
    fillFeesUsd: opt(r.fill_fees_usd),
    closedAt: r.closed_at ? ms(r.closed_at) : null,
    closeReason: r.close_reason ? String(r.close_reason) : undefined,
    closePnlUsd: opt(r.close_pnl_usd),
    error: r.error ? String(r.error) : undefined,
    reason: r.reason ? String(r.reason) : undefined,
    createdAt: ms(r.created_at),
    updatedAt: ms(r.updated_at),
  };
}

export const neonLiveStore: LiveStore = {
  async liveStrategies(): Promise<LiveStrategy[]> {
    const sql = sqlOrThrow();
    const rows = await sql`
      select s.*, l.session_id, l.status as live_status, l.total_cap_usd, l.spent_usd,
             w.trader_address, w.session_address, w.expires_at
      from studio.live_strategies l
      join studio.strategies s on s.id = l.strategy_id
      join studio.wallet_sessions w on w.id = l.session_id
      where l.status in ('active', 'paused', 'closing')`;
    return rows.map((r) => ({
      id: String(r.id),
      ownerId: String(r.owner_id),
      name: String(r.name),
      symbol: String(r.symbol),
      marketId: String(r.market_id),
      status: r.status as LiveStrategy["status"],
      spec: StrategySpecSchema.parse(r.spec),
      paperSince: msOrNull(r.paper_since),
      blownOutAt: msOrNull(r.blown_out_at),
      live: {
        sessionId: String(r.session_id),
        trader: String(r.trader_address) as Hex,
        sessionAddress: String(r.session_address) as Hex,
        status: r.live_status as LiveStrategy["live"]["status"],
        expiresAt: msOrNull(r.expires_at),
        totalCapUsd: num(r.total_cap_usd),
        spentUsd: num(r.spent_usd),
      },
    }));
  },

  async session(id) {
    const sql = sqlOrThrow();
    const rows = await sql`select * from studio.wallet_sessions where id = ${id}`;
    return rows[0] ? toSession(rows[0]) : null;
  },

  async sessionForWallet(ownerId, trader) {
    const sql = sqlOrThrow();
    const rows = await sql`
      select * from studio.wallet_sessions
      where owner_id = ${ownerId} and lower(trader_address) = ${trader.toLowerCase()} and status <> 'ended'
      order by created_at desc limit 1`;
    return rows[0] ? toSession(rows[0]) : null;
  },

  async createSession(s: NewSession, nowMs) {
    const sql = sqlOrThrow();
    const rows = await sql`
      insert into studio.wallet_sessions (id, owner_id, trader_address, session_address, kms_key_id, expires_at, created_at)
      values (coalesce(${s.id ?? null}::uuid, gen_random_uuid()), ${s.ownerId}, ${s.trader}, ${s.sessionAddress}, ${s.kmsKeyId}, ${s.expiresAt ? iso(s.expiresAt) : null}, ${iso(nowMs)})
      returning *`;
    return toSession(rows[0]);
  },

  async setSessionStatus(id, to, from, nowMs, reason) {
    const sql = sqlOrThrow();
    const ended = to === "ended" || to === "permission-ended";
    const rows = await sql`
      update studio.wallet_sessions
      set status = ${to},
          activated_at = case when ${to} = 'active' and activated_at is null then ${iso(nowMs)}::timestamptz else activated_at end,
          ended_at = case when ${ended} then ${iso(nowMs)}::timestamptz else ended_at end,
          ended_reason = case when ${ended} then ${reason ?? null} else ended_reason end
      where id = ${id} and status = any(${from}::text[])
      returning id`;
    return rows.length > 0;
  },

  async setSessionTxs(id, txs) {
    const sql = sqlOrThrow();
    await sql`
      update studio.wallet_sessions
      set approve_tx = coalesce(${txs.approveTx ?? null}, approve_tx),
          delegate_tx = coalesce(${txs.delegateTx ?? null}, delegate_tx),
          gas_topup_tx = coalesce(${txs.gasTopupTx ?? null}, gas_topup_tx)
      where id = ${id}`;
  },

  async setSessionExpiry(id, expiresAtMs) {
    const sql = sqlOrThrow();
    await sql`update studio.wallet_sessions set expires_at = ${expiresAtMs ? iso(expiresAtMs) : null} where id = ${id}`;
  },

  async setDelegateCheck(id, atMs, allowanceUsd) {
    const sql = sqlOrThrow();
    await sql`update studio.wallet_sessions set last_delegate_check = ${iso(atMs)}, allowance_usd = ${allowanceUsd} where id = ${id}`;
  },

  async link(strategyId) {
    const sql = sqlOrThrow();
    const rows = await sql`select * from studio.live_strategies where strategy_id = ${strategyId}`;
    return rows[0] ? toLink(rows[0]) : null;
  },

  async linksForSession(sessionId) {
    const sql = sqlOrThrow();
    const rows = await sql`select * from studio.live_strategies where session_id = ${sessionId} order by started_at`;
    return rows.map(toLink);
  },

  async upsertLink(l, nowMs) {
    const sql = sqlOrThrow();
    await sql`
      insert into studio.live_strategies (strategy_id, session_id, owner_id, status, total_cap_usd, spent_usd, started_at, ended_at, ended_reason)
      values (${l.strategyId}, ${l.sessionId}, ${l.ownerId}, 'active', ${l.totalCapUsd}, 0, ${iso(nowMs)}, null, null)
      on conflict (strategy_id) do update
        set session_id = excluded.session_id, status = 'active', total_cap_usd = excluded.total_cap_usd, spent_usd = 0,
            started_at = excluded.started_at, ended_at = null, ended_reason = null`;
  },

  async setLinkStatus(strategyId, to, from, nowMs, reason) {
    const sql = sqlOrThrow();
    const ended = to === "ended" || to === "permission-ended";
    const rows = await sql`
      update studio.live_strategies
      set status = ${to},
          ended_at = case when ${ended} then ${iso(nowMs)}::timestamptz else ended_at end,
          ended_reason = case when ${ended} then ${reason ?? null} else ended_reason end
      where strategy_id = ${strategyId} and status = any(${from}::text[])
      returning strategy_id`;
    return rows.length > 0;
  },

  async setLinkCap(strategyId, totalCapUsd) {
    const sql = sqlOrThrow();
    await sql`update studio.live_strategies set total_cap_usd = ${totalCapUsd} where strategy_id = ${strategyId}`;
  },

  async addSpent(strategyId, usd) {
    const sql = sqlOrThrow();
    await sql`update studio.live_strategies set spent_usd = spent_usd + ${usd} where strategy_id = ${strategyId}`;
  },

  async setStrategyLive(strategyId, live) {
    const sql = sqlOrThrow();
    if (live) {
      await sql`
        update studio.strategies set status = 'live', spec = jsonb_set(spec, '{status}', '"live"'), updated_at = now()
        where id = ${strategyId}`;
    } else {
      await sql`
        update studio.strategies set status = 'draft', spec = jsonb_set(spec, '{status}', '"draft"'), updated_at = now()
        where id = ${strategyId} and status = 'live'`;
    }
  },

  async createOrder(o: NewOrder) {
    const sql = sqlOrThrow();
    const rows = await sql`
      insert into studio.live_orders (strategy_id, session_id, owner_id, kind, ref, market_id, symbol, candle_date, collateral_usd, leverage,
                                      take_profit, stop_loss, pid, position_index, reason, created_at, updated_at)
      values (${o.strategyId}, ${o.sessionId}, ${o.ownerId}, ${o.kind}, ${o.ref}, ${o.marketId}, ${o.symbol}, ${o.candleDate ?? null},
              ${o.collateralUsd ?? null}, ${o.leverage ?? null}, ${o.takeProfit ?? null}, ${o.stopLoss ?? null}, ${o.pid ?? null},
              ${o.positionIndex ?? null}, ${o.reason ?? null}, ${iso(o.createdAt)}, ${iso(o.createdAt)})
      on conflict (strategy_id, kind, ref) do nothing
      returning *`;
    return rows[0] ? toOrder(rows[0]) : null;
  },

  async updateOrder(id, p: OrderPatch) {
    const sql = sqlOrThrow();
    await sql`
      update studio.live_orders
      set tx_hash = coalesce(${p.txHash ?? null}, tx_hash),
          oid = coalesce(${p.oid ?? null}, oid),
          pid = coalesce(${p.pid ?? null}, pid),
          position_index = coalesce(${p.positionIndex ?? null}, position_index),
          status = coalesce(${p.status ?? null}, status),
          fill_price = coalesce(${p.fillPrice ?? null}, fill_price),
          fill_pnl_usd = coalesce(${p.fillPnlUsd ?? null}, fill_pnl_usd),
          fill_fees_usd = coalesce(${p.fillFeesUsd ?? null}, fill_fees_usd),
          closed_at = coalesce(${p.closedAt ? iso(p.closedAt) : null}::timestamptz, closed_at),
          close_reason = coalesce(${p.closeReason ?? null}, close_reason),
          close_pnl_usd = coalesce(${p.closePnlUsd ?? null}, close_pnl_usd),
          error = coalesce(${p.error ?? null}, error),
          updated_at = ${iso(p.updatedAt)}
      where id = ${id}`;
  },

  async order(strategyId, kind, ref) {
    const sql = sqlOrThrow();
    const rows = await sql`select * from studio.live_orders where strategy_id = ${strategyId} and kind = ${kind} and ref = ${ref}`;
    return rows[0] ? toOrder(rows[0]) : null;
  },

  async pendingOrders(strategyId) {
    const sql = sqlOrThrow();
    const rows = strategyId
      ? await sql`select * from studio.live_orders where strategy_id = ${strategyId} and status in ('building', 'submitted') order by created_at`
      : await sql`select * from studio.live_orders where status in ('building', 'submitted') order by created_at`;
    return rows.map(toOrder);
  },

  async openOrders(strategyId) {
    const sql = sqlOrThrow();
    const rows = strategyId
      ? await sql`select * from studio.live_orders where strategy_id = ${strategyId} and kind = 'open' and status = 'filled' and closed_at is null order by created_at`
      : await sql`select * from studio.live_orders where kind = 'open' and status = 'filled' and closed_at is null order by created_at`;
    return rows.map(toOrder);
  },

  async ordersForStrategy(strategyId, limit = 50) {
    const sql = sqlOrThrow();
    const rows = await sql`select * from studio.live_orders where strategy_id = ${strategyId} order by created_at desc limit ${limit}`;
    return rows.map(toOrder);
  },

  async closedPnlForDay(strategyId, day) {
    const sql = sqlOrThrow();
    const rows = await sql`
      select coalesce(sum(close_pnl_usd), 0) as pnl, coalesce(sum(fill_fees_usd), 0) as fees, count(*) as trades
      from studio.live_orders
      where strategy_id = ${strategyId} and kind = 'open' and closed_at is not null and (closed_at at time zone 'utc')::date = ${day}::date`;
    const r = rows[0];
    return { pnlUsd: num(r?.pnl), feesUsd: num(r?.fees), trades: num(r?.trades) };
  },

  async upsertDailyResult(strategyId, day, r) {
    const sql = sqlOrThrow();
    await sql`
      insert into studio.daily_results (strategy_id, day, realised_pnl_usd, fees_usd, trades, updated_at)
      values (${strategyId}, ${day}::date, ${r.pnlUsd}, ${r.feesUsd}, ${r.trades}, now())
      on conflict (strategy_id, day) do update
        set realised_pnl_usd = excluded.realised_pnl_usd, fees_usd = excluded.fees_usd, trades = excluded.trades, updated_at = now()`;
  },
};

/** Reads for the pages, not part of the runner's store. */
export async function liveLinkWithSession(strategyId: string): Promise<{ link: LiveLink; session: WalletSession } | null> {
  const sql = getDb();
  if (!sql) return null;
  const rows = await sql`
    select l.*, row_to_json(w.*) as session from studio.live_strategies l
    join studio.wallet_sessions w on w.id = l.session_id
    where l.strategy_id = ${strategyId}`;
  if (!rows[0]) return null;
  return { link: toLink(rows[0]), session: toSession(rows[0].session as Record<string, unknown>) };
}

export async function liveLinksForOwner(ownerId: string): Promise<Array<{ link: LiveLink; session: WalletSession }>> {
  const sql = getDb();
  if (!sql) return [];
  const rows = await sql`
    select l.*, row_to_json(w.*) as session from studio.live_strategies l
    join studio.wallet_sessions w on w.id = l.session_id
    where l.owner_id = ${ownerId} and l.status <> 'ended'`;
  return rows.map((r) => ({ link: toLink(r), session: toSession(r.session as Record<string, unknown>) }));
}
