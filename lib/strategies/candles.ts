import "server-only";

import type { CandleSource } from "@/lib/strategies/backtest";
import { ostium } from "@/lib/venues/ostium";

/**
 * The first candle source (Studio step 4): Ostium's own daily candles. Its
 * history begins on 2024-01-01 for crypto and at listing for newer markets,
 * and the venue refuses a request wider than 10,000 candles, so daily from
 * 2015 is the widest safe ask. A licensed vendor plugs in by implementing
 * CandleSource; every result shows where its history starts.
 */
export const HISTORY_FROM_MS = Date.UTC(2015, 0, 1);

export const ostiumDailyCandles: CandleSource = {
  daily: (marketId, fromMs, toMs) => ostium.candles(marketId, "1D", fromMs, toMs),
};

/** Daily candles up to yesterday: today's bar is still forming. */
export async function completedDailyCandles(source: CandleSource, marketId: string, nowMs = Date.now()) {
  const todayStart = Math.floor(nowMs / 86_400_000) * 86_400_000;
  const candles = await source.daily(marketId, HISTORY_FROM_MS, nowMs);
  return candles.filter((c) => c.time < todayStart);
}
