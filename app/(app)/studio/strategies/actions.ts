"use server";

import { auth } from "@clerk/nextjs/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";

import { requireInternalAdmin } from "@/lib/auth";
import { referenceFor, toleranceBps } from "@/lib/chainlink/read";
import { checkRisk, type RiskFinding } from "@/lib/risk/check";
import { runBacktest, type BacktestResult, type MarketSnapshot } from "@/lib/strategies/backtest";
import { completedDailyCandles, ostiumDailyCandles } from "@/lib/strategies/candles";
import { getStrategy, insertBacktest, insertStrategy, lossTodayUsd, storageConfigured } from "@/lib/strategies/db";
import { StrategySpecSchema, type StrategySpec } from "@/lib/strategies/spec";
import { isTestnet, ostium } from "@/lib/venues/ostium";
import type { Market } from "@/lib/venues/types";

/**
 * Server actions for strategies (Studio step 4). Behind the admin allowlist
 * for now, with the Clerk user as owner. Creating a strategy parses the
 * spec, runs it through the risk checker against the live market, saves
 * it, then runs and stores its first backtest. A refusal saves nothing; a
 * closed market is a warning, since a draft is a spec and not an order.
 */

type Result<T> = ({ ok: true } & T) | { ok: false; error: string; refusals?: RiskFinding[] };

function fail(error: unknown): { ok: false; error: string } {
  return { ok: false, error: error instanceof Error ? error.message : String(error) };
}

async function owner(): Promise<string> {
  await requireInternalAdmin();
  const { userId } = await auth();
  if (!userId) throw new Error("Not signed in");
  if (!storageConfigured()) throw new Error("Storage is not configured: set DATABASE_URL and run npm run db:setup.");
  return userId;
}

function snapshot(m: Market): MarketSnapshot {
  return { symbol: m.symbol, limits: m.limits, openInterest: m.openInterest, hours: m.hours, fees: m.fees, rollover8h: m.rollover8h };
}

async function backtestFor(spec: StrategySpec, market: Market): Promise<{ results: BacktestResult; candleCount: number }> {
  const candles = await completedDailyCandles(ostiumDailyCandles, spec.market.marketId);
  const results = runBacktest({ spec, candles, market: snapshot(market), testnet: true });
  return { results, candleCount: candles.length };
}

async function storeBacktest(spec: StrategySpec, market: Market) {
  const { results, candleCount } = await backtestFor(spec, market);
  const row = await insertBacktest(spec.id, {
    spec,
    market: snapshot(market),
    source: "ostium daily",
    candleCount,
    windowStart: results.windowStart,
    windowEnd: results.windowEnd,
    ranAt: Date.now(),
  }, results);
  return row;
}

export interface MarketOption {
  id: string;
  symbol: string;
  category: string;
  maxLeverage: number;
  overnightMaxLeverage: number;
  openBps: number;
  isOpen: boolean;
}

export async function marketsForFormAction(): Promise<Result<{ markets: MarketOption[] }>> {
  try {
    await requireInternalAdmin();
    const markets = (await ostium.markets()).map((m) => ({
      id: m.id,
      symbol: m.symbol,
      category: m.category,
      maxLeverage: m.limits.maxLeverage,
      overnightMaxLeverage: m.limits.overnightMaxLeverage,
      openBps: m.fees.openBps,
      isOpen: m.hours.isOpen,
    }));
    return { ok: true, markets };
  } catch (error) {
    return fail(error);
  }
}

export async function createStrategyAction(raw: unknown): Promise<Result<{ id: string; warnings: string[] }>> {
  try {
    const ownerId = await owner();
    const draft = { ...(raw as Record<string, unknown>), id: randomUUID(), status: "draft" };
    const parsed = StrategySpecSchema.safeParse(draft);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return { ok: false, error: issue ? `${issue.path.join(".")}: ${issue.message}` : "Invalid strategy" };
    }
    const spec = parsed.data;
    const market = (await ostium.markets()).find((m) => m.id === spec.market.marketId);
    if (!market || market.symbol !== spec.market.symbol) return { ok: false, error: "Unknown market" };

    const [price] = await ostium.prices([market.id]);
    const reference = price ? await referenceFor(market.symbol, price.mid) : null;
    const risk = checkRisk({
      kind: "open",
      tier: spec.tier,
      testnet: isTestnet(),
      intent: {
        marketId: spec.market.marketId,
        side: "long",
        collateralUsd: spec.size.collateralUsd,
        leverage: spec.size.leverage,
        orderType: "market",
      },
      market,
      sizeUsd: spec.size.collateralUsd * spec.size.leverage,
      strategy: {
        strategyId: spec.id,
        openNotionalUsd: 0,
        dailyLossLimitUsd: spec.caps.dailyLossLimitUsd,
        lossTodayUsd: await lossTodayUsd(spec.id),
      },
      reference,
      limits: { maxPositionUsdPerStrategy: spec.caps.maxPositionUsd, referenceToleranceBps: toleranceBps() },
    });
    const blocking = risk.refusals.filter((f) => f.code !== "market-closed");
    const warnings = risk.refusals.filter((f) => f.code === "market-closed").map((f) => f.message);
    if (blocking.length > 0) {
      return { ok: false, error: "The risk checker refuses this strategy.", refusals: blocking };
    }

    await insertStrategy(ownerId, spec);
    await storeBacktest(spec, market);
    return { ok: true, id: spec.id, warnings };
  } catch (error) {
    return fail(error);
  }
}

export async function rerunBacktestAction(id: string): Promise<Result<{ backtestId: string }>> {
  try {
    const ownerId = await owner();
    const row = await getStrategy(z.string().uuid().parse(id), ownerId);
    if (!row) return { ok: false, error: "Not found" };
    const market = (await ostium.markets()).find((m) => m.id === row.spec.market.marketId);
    if (!market) return { ok: false, error: "The strategy's market is no longer listed." };
    const backtest = await storeBacktest(row.spec, market);
    return { ok: true, backtestId: backtest.id };
  } catch (error) {
    return fail(error);
  }
}
