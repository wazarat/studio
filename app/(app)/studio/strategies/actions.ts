"use server";

import { auth } from "@clerk/nextjs/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";

import { requireInternalAdmin } from "@/lib/auth";
import { referenceFor, toleranceBps } from "@/lib/chainlink/read";
import { checkRisk, type RiskFinding } from "@/lib/risk/check";
import { runBacktest, type BacktestResult, type MarketSnapshot } from "@/lib/strategies/backtest";
import { getStrategy, insertBacktest, insertStrategy, lossTodayUsd, storageConfigured, updateStrategy } from "@/lib/strategies/db";
import { cachedCandles, loadMarkets, type MarketsBundle } from "@/lib/strategies/markets";
import { StrategySpecSchema, type StrategySpec } from "@/lib/strategies/spec";
import { isTestnet, ostium } from "@/lib/venues/ostium";
import type { Candle, Market } from "@/lib/venues/types";

/**
 * Server actions for the workspace (Studio step 4b). Behind the admin
 * allowlist with the Clerk user as owner. The browser runs the engine for
 * the live preview; Save runs the same engine here on the same cached
 * candles and stores the result, after the risk checker against the live
 * market. A refusal saves nothing; a closed market is only a warning.
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

async function storeBacktest(spec: StrategySpec, market: Market): Promise<BacktestResult> {
  const candles = await cachedCandles(spec.market.marketId);
  const results = runBacktest({ spec, candles, market: snapshot(market), testnet: true });
  await insertBacktest(spec.id, {
    spec,
    market: snapshot(market),
    source: "ostium daily",
    candleCount: candles.length,
    windowStart: results.windowStart,
    windowEnd: results.windowEnd,
    ranAt: Date.now(),
  }, results);
  return results;
}

export async function candlesAction(marketId: string): Promise<Result<{ candles: Candle[] }>> {
  try {
    await requireInternalAdmin();
    return { ok: true, candles: await cachedCandles(z.string().min(1).parse(marketId)) };
  } catch (error) {
    return fail(error);
  }
}

export async function marketsAction(): Promise<Result<MarketsBundle>> {
  try {
    await requireInternalAdmin();
    return { ok: true, ...(await loadMarkets()) };
  } catch (error) {
    return fail(error);
  }
}

export async function saveStrategyAction(raw: unknown, id?: string): Promise<Result<{ id: string; warnings: string[]; results: BacktestResult }>> {
  try {
    const ownerId = await owner();
    let existingStatus: StrategySpec["status"] = "draft";
    if (id) {
      const row = await getStrategy(z.string().uuid().parse(id), ownerId);
      if (!row) return { ok: false, error: "Not found" };
      existingStatus = row.status;
    }
    const parsed = StrategySpecSchema.safeParse({ ...(raw as Record<string, unknown>), id: id ?? randomUUID(), status: existingStatus });
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return { ok: false, error: issue ? `${issue.path.join(".")}: ${issue.message}` : "Invalid strategy" };
    }
    const spec = parsed.data;
    const market = (await ostium.markets()).find((m) => m.id === spec.market.marketId);
    if (!market || market.symbol !== spec.market.symbol) return { ok: false, error: "Unknown market" };

    const [price] = await ostium.prices([market.id]).catch(() => []);
    const reference = price ? await referenceFor(market.symbol, price.mid).catch(() => null) : null;
    const risk = checkRisk({
      kind: "open",
      tier: spec.tier,
      testnet: isTestnet(),
      intent: { marketId: spec.market.marketId, side: "long", collateralUsd: spec.size.collateralUsd, leverage: spec.size.leverage, orderType: "market" },
      market,
      sizeUsd: spec.size.collateralUsd * spec.size.leverage,
      strategy: { strategyId: spec.id, openNotionalUsd: 0, dailyLossLimitUsd: spec.caps.dailyLossLimitUsd, lossTodayUsd: await lossTodayUsd(spec.id) },
      reference,
      limits: { maxPositionUsdPerStrategy: spec.caps.maxPositionUsd, referenceToleranceBps: toleranceBps() },
    });
    const blocking = risk.refusals.filter((f) => f.code !== "market-closed");
    const warnings = risk.refusals.filter((f) => f.code === "market-closed").map((f) => f.message);
    if (blocking.length > 0) return { ok: false, error: "The risk checker refuses this strategy.", refusals: blocking };

    if (id) {
      const updated = await updateStrategy(ownerId, spec);
      if (!updated) return { ok: false, error: "Not found" };
    } else {
      await insertStrategy(ownerId, spec);
    }
    const results = await storeBacktest(spec, market);
    return { ok: true, id: spec.id, warnings, results };
  } catch (error) {
    return fail(error);
  }
}
