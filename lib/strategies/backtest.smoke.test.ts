import { describe, expect, it } from "vitest";

import { runBacktest } from "@/lib/strategies/backtest";
import { completedDailyCandles, ostiumDailyCandles } from "@/lib/strategies/candles";
import type { StrategySpec } from "@/lib/strategies/spec";
import { ostium } from "@/lib/venues/ostium";

/**
 * Real candles, real costs (Studio step 4): fetches BTC/USD daily history
 * from Ostium and backtests a 10/30 MA cross with the live fee snapshot.
 * Network only, no transactions. Opt in with OSTIUM_SMOKE=1:
 *
 *   OSTIUM_SMOKE=1 node --env-file=.env.local node_modules/vitest/vitest.mjs run lib/strategies/backtest.smoke.test.ts
 */
const enabled = process.env.OSTIUM_SMOKE === "1";

describe.skipIf(!enabled)("backtest on Ostium history", () => {
  it("runs a BTC/USD MA cross over the venue's whole daily history", async () => {
    const market = (await ostium.markets()).find((m) => m.id === "0")!;
    const candles = await completedDailyCandles(ostiumDailyCandles, "0");
    const spec: StrategySpec = {
      id: "smoke",
      name: "BTC 10/30",
      market: { venue: "ostium", marketId: "0", symbol: market.symbol },
      direction: "long",
      entry: { kind: "maCross", fast: 10, slow: 30 },
      exit: { stopLossPct: 8 },
      size: { collateralUsd: 100, leverage: 2 },
      wake: { kind: "candle-close", resolution: "1D" },
      caps: { maxPositionUsd: 1000, dailyLossLimitUsd: 50 },
      tier: "studio",
      status: "draft",
    };
    const r = runBacktest({ spec, candles, market });
    const day = (ms: number) => new Date(ms).toISOString().slice(0, 10);
    console.log(
      `[smoke] ${market.symbol}: history from ${day(r.historyStart)}, ${r.candleCount} candles to ${day(r.windowEnd)}\n` +
        `[smoke] costs: open ${r.costs.openBps} bps, oracle $${r.costs.oracleFeeUsd}, rollover ${r.costs.rollover8hPct}%/8h\n` +
        `[smoke] strategy: ${r.strategy.returnPct.toFixed(2)}% return, ${r.strategy.maxDrawdownPct.toFixed(2)}% max dd, ${r.strategy.trades} trades, ${r.strategy.winRatePct.toFixed(0)}% wins, $${r.strategy.feesUsd.toFixed(2)} fees, ${r.skipped.length} refused\n` +
        `[smoke] buy&hold: ${r.buyAndHold.returnPct.toFixed(2)}% return, ${r.buyAndHold.maxDrawdownPct.toFixed(2)}% max dd, $${r.buyAndHold.feesUsd.toFixed(2)} fees`,
    );
    expect(day(r.historyStart)).toBe("2024-01-01");
    expect(r.candleCount).toBeGreaterThan(600);
    expect(r.strategy.trades).toBeGreaterThan(0);
    expect(r.buyAndHold.trades).toBe(1);
  }, 120_000);
});
