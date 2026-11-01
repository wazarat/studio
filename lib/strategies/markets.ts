import "server-only";

import { completedDailyCandles, ostiumDailyCandles } from "@/lib/strategies/candles";
import { getPriceChanges24h, ostium } from "@/lib/venues/ostium";
import type { Candle, Market, Price } from "@/lib/venues/types";

/**
 * Market data for the dashboard and the workspace (Studio step 4b): the
 * venue's markets, one-shot prices and 24h change together, and daily
 * candles cached per market for ten minutes so a page load and the
 * browser's own backtest see the same bars.
 */
export interface MarketsBundle {
  markets: Market[];
  prices: Price[];
  /** 24h change in percent by market id; missing when the venue had none. */
  changes: Record<string, number>;
  at: number;
}

export async function loadMarkets(): Promise<MarketsBundle> {
  const [markets, prices, changes] = await Promise.all([
    ostium.markets(),
    ostium.prices().catch(() => [] as Price[]),
    getPriceChanges24h(),
  ]);
  return { markets, prices, changes: Object.fromEntries(changes), at: Date.now() };
}

const CANDLES_TTL_MS = 10 * 60 * 1000;
const candleCache = new Map<string, { at: number; candles: Candle[] }>();
const inflight = new Map<string, Promise<Candle[]>>();

export async function cachedCandles(marketId: string): Promise<Candle[]> {
  const hit = candleCache.get(marketId);
  if (hit && Date.now() - hit.at < CANDLES_TTL_MS) return hit.candles;
  let p = inflight.get(marketId);
  if (!p) {
    p = completedDailyCandles(ostiumDailyCandles, marketId)
      .then((candles) => {
        candleCache.set(marketId, { at: Date.now(), candles });
        return candles;
      })
      .finally(() => inflight.delete(marketId));
    inflight.set(marketId, p);
  }
  return p;
}
