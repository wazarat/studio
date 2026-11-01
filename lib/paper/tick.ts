import "server-only";

import { referenceFor, toleranceBps } from "@/lib/chainlink/read";
import { getDb } from "@/lib/db";
import { closeForStop, runTick } from "@/lib/paper/runner";
import { neonPaperStore } from "@/lib/paper/store-neon";
import type { TickDeps, TickReport } from "@/lib/paper/store";
import { completedDailyCandles, ostiumDailyCandles } from "@/lib/strategies/candles";
import { isTestnet, ostium } from "@/lib/venues/ostium";

/**
 * The paper tick with real dependencies (Studio step 5): the Neon store,
 * Ostium prices and markets, the venue's completed daily candles read
 * fresh (not the page cache, so the tick after midnight sees the new
 * candle), and the Chainlink reference. The cron route and the manual
 * button both call this.
 */
export function paperDeps(): TickDeps {
  return {
    store: neonPaperStore,
    prices: { prices: (ids) => ostium.prices(ids) },
    markets: () => ostium.markets(),
    candles: (marketId, nowMs) => completedDailyCandles(ostiumDailyCandles, marketId, nowMs),
    reference: referenceFor,
    testnet: isTestnet(),
    riskLimits: { referenceToleranceBps: toleranceBps() },
  };
}

export async function runPaperTick(now = Date.now()): Promise<TickReport> {
  if (!getDb()) {
    return { at: now, positionsChecked: 0, exits: 0, runs: 0, entries: 0, refusals: 0, skips: 0, errors: ["Storage not configured"], lines: [] };
  }
  return runTick(paperDeps(), now);
}

export function stopPaper(strategyId: string, now = Date.now()) {
  return closeForStop(paperDeps(), strategyId, now);
}
