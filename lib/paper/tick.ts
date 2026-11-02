import "server-only";

import { referenceFor, toleranceBps } from "@/lib/chainlink/read";
import { getDb } from "@/lib/db";
import { liveDeps, type LiveControls } from "@/lib/live/executor";
import { sessionDepsFor } from "@/lib/live/session";
import { neonLiveStore } from "@/lib/live/store-neon";
import { closeForStop, runTick } from "@/lib/paper/runner";
import { neonPaperStore } from "@/lib/paper/store-neon";
import type { LiveDeps, TickDeps, TickReport } from "@/lib/paper/store";
import { isKmsConfigured } from "@/lib/signers/kms";
import { completedDailyCandles, ostiumDailyCandles } from "@/lib/strategies/candles";
import { isTestnet, ostium } from "@/lib/venues/ostium";

/**
 * The paper tick with real dependencies (Studio step 5): the Neon store,
 * Ostium prices and markets, the venue's completed daily candles read
 * fresh (not the page cache, so the tick after midnight sees the new
 * candle), and the Chainlink reference. The cron route and the manual
 * button both call this. Live strategies (step 7) ride the same tick when
 * the venue is on testnet and AWS KMS is configured.
 */
export function liveEnabled(): boolean {
  return isTestnet() && isKmsConfigured();
}

export function liveExecutor(): (LiveDeps & LiveControls) | null {
  if (!liveEnabled()) return null;
  return liveDeps({
    live: neonLiveStore,
    paper: neonPaperStore,
    sessionDepsFor,
    reference: referenceFor,
    testnet: true,
    riskLimits: { referenceToleranceBps: toleranceBps() },
  });
}

export function paperDeps(): TickDeps {
  return {
    store: neonPaperStore,
    prices: { prices: (ids) => ostium.prices(ids) },
    markets: () => ostium.markets(),
    candles: (marketId, nowMs) => completedDailyCandles(ostiumDailyCandles, marketId, nowMs),
    reference: referenceFor,
    testnet: isTestnet(),
    riskLimits: { referenceToleranceBps: toleranceBps() },
    live: liveExecutor() ?? undefined,
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
