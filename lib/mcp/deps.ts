import "server-only";

import { randomUUID } from "node:crypto";

import { referenceFor, toleranceBps } from "@/lib/chainlink/read";
import type { AccountDeps, StrategySummary } from "@/lib/mcp/account-tools";
import { touchConnection } from "@/lib/mcp/connections";
import { memoryRateLimiter, type RegistrarEnv } from "@/lib/mcp/register";
import type { StrategyDeps } from "@/lib/mcp/strategy-tools";
import { mergeActivity, paperEvent } from "@/lib/paper/activity";
import { paperActivityFor } from "@/lib/paper/store-neon";
import { loadPaperForStrategy } from "@/lib/paper/summary";
import { insertProposal, pendingProposals } from "@/lib/proposals/db";
import { activityFromBacktests } from "@/lib/strategies/activity";
import { runBacktest, type MarketSnapshot } from "@/lib/strategies/backtest";
import { getStrategy, insertBacktest, insertStrategy, latestBacktest, latestBacktests, listStrategies, lossTodayUsd } from "@/lib/strategies/db";
import { cachedCandles } from "@/lib/strategies/markets";
import type { StrategySpec } from "@/lib/strategies/spec";
import { isTestnet, ostium } from "@/lib/venues/ostium";
import type { Market } from "@/lib/venues/types";

/** The real dependencies behind both servers (step 6). */

const limiter = memoryRateLimiter();

export function registrarEnv(appUrl: string, server: string): RegistrarEnv {
  return {
    limiter,
    appUrl,
    onCall: (caller, _tool) => touchConnection(caller.userId, caller.clientId, caller.clientName, server),
  };
}

function snapshot(m: Market): MarketSnapshot {
  return { symbol: m.symbol, limits: m.limits, openInterest: m.openInterest, hours: m.hours, fees: m.fees, rollover8h: m.rollover8h };
}

async function storeBacktest(spec: StrategySpec, market: Market) {
  const candles = await cachedCandles(spec.market.marketId);
  const results = runBacktest({ spec, candles, market: snapshot(market), testnet: true });
  await insertBacktest(spec.id, { spec, market: snapshot(market), source: "ostium daily", candleCount: candles.length, windowStart: results.windowStart, windowEnd: results.windowEnd, ranAt: Date.now() }, results);
  return results;
}

export function accountDeps(): AccountDeps {
  return {
    markets: () => ostium.markets(),
    prices: (ids) => ostium.prices(ids),
    candles: (id) => cachedCandles(id),
    async listStrategies(ownerId): Promise<StrategySummary[]> {
      const rows = await listStrategies(ownerId);
      const latest = await latestBacktests(rows.map((r) => r.id));
      return rows.map((r) => ({ id: r.id, name: r.name, symbol: r.symbol, status: r.status, blownOut: Boolean(r.blownOutAt), spec: r.spec, latest: latest.get(r.id)?.results.strategy ?? null, updatedAt: r.updatedAt }));
    },
    async insertStrategy(ownerId, spec) {
      await insertStrategy(ownerId, spec);
    },
    storeBacktest,
    async activity(ownerId, limit) {
      const [rows, paperRows] = await Promise.all([listStrategies(ownerId), paperActivityFor(ownerId, null, limit)]);
      const backtests = await latestBacktests(rows.map((r) => r.id));
      const results = new Map(Array.from(backtests, ([id, b]) => [id, b.results]));
      const byId = new Map(rows.map((r) => [r.id, r]));
      return mergeActivity(
        activityFromBacktests(rows, results, limit),
        paperRows.map((r) => paperEvent(r, byId.get(r.strategyId)?.name ?? "Strategy", byId.get(r.strategyId)?.symbol ?? "")),
        limit,
      );
    },
    reference: referenceFor,
    lossTodayUsd: (id) => lossTodayUsd(id),
    newId: () => randomUUID(),
    testnet: isTestnet(),
    riskLimits: { referenceToleranceBps: toleranceBps() },
  };
}

export function strategyDeps(): StrategyDeps {
  return {
    async getStrategy(id, ownerId) {
      const row = await getStrategy(id, ownerId);
      return row ? { id: row.id, ownerId: row.ownerId, name: row.name, symbol: row.symbol, marketId: row.marketId, status: row.status, spec: row.spec, paperSince: row.paperSince, blownOutAt: row.blownOutAt, updatedAt: row.updatedAt } : null;
    },
    async latestBacktest(id) {
      const b = await latestBacktest(id);
      return b ? { results: b.results, createdAt: b.createdAt } : null;
    },
    paperFor: (ownerId, row) => loadPaperForStrategy(ownerId, row.id, row.status, row.paperSince, row.blownOutAt),
    markets: () => ostium.markets(),
    prices: (ids) => ostium.prices(ids),
    candles: (id) => cachedCandles(id),
    insertProposal,
    pendingProposals,
    reference: referenceFor,
    lossTodayUsd: (id) => lossTodayUsd(id),
    testnet: isTestnet(),
    riskLimits: { referenceToleranceBps: toleranceBps() },
  };
}
