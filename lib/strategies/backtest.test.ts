import { describe, expect, it } from "vitest";

import { BacktestError, runBacktest, type MarketSnapshot } from "@/lib/strategies/backtest";
import type { StrategySpec } from "@/lib/strategies/spec";
import type { Candle } from "@/lib/venues/types";

/**
 * Hand-built candle series with obvious trades, so every fee number is
 * checked by arithmetic: notional 200 (100 at 2x), open fee 10 bps = 0.20,
 * oracle 0.50 per order, rollover 0.01% per 8h = 0.06 per day.
 */

const DAY = 86_400_000;
const day = (k: number) => Date.UTC(2024, 0, 1) + k * DAY;

/** 24/7-style bars: each opens where the previous closed. */
function bars(closes: number[], times?: number[]): Candle[] {
  return closes.map((close, i) => {
    const open = i === 0 ? close : closes[i - 1];
    return { time: times ? times[i] : day(i), open, high: Math.max(open, close), low: Math.min(open, close), close };
  });
}

function market(overrides: Partial<MarketSnapshot> = {}): MarketSnapshot {
  return {
    symbol: "BTC/USD",
    limits: { minNotionalUsd: 5, maxNotionalLongUsd: 1e6, maxNotionalShortUsd: 1e6, minLeverage: 1, maxLeverage: 50, overnightMaxLeverage: 0 },
    openInterest: { longUsd: 400_000, shortUsd: 100_000, maxPerSideUsd: 500_000 },
    hours: { isOpen: true, isDayTradingClosed: false, secondsToToggleDayTrading: null, checkedAt: 0 },
    fees: { openBps: 10, closeBps: 0, oracleFeeUsd: 0.5 },
    rollover8h: { long: 0.01, short: 0.01 },
    ...overrides,
  };
}

function spec(overrides: Partial<StrategySpec> = {}): StrategySpec {
  return {
    id: "s1",
    name: "Test",
    market: { venue: "ostium", marketId: "0", symbol: "BTC/USD" },
    direction: "long",
    entry: { kind: "maCross", fast: 2, slow: 3 },
    exit: {},
    size: { collateralUsd: 100, leverage: 2 },
    wake: { kind: "candle-close", resolution: "1D" },
    caps: { maxPositionUsd: 1000, dailyLossLimitUsd: 0 },
    tier: "studio",
    status: "draft",
    ...overrides,
  };
}

const V = [12, 11, 10, 9, 8, 9, 10, 13, 14, 15, 14, 12, 10, 9];

describe("runBacktest", () => {
  it("MA-cross V: one trade with exact fees, buy-and-hold alongside", () => {
    const r = runBacktest({ spec: spec(), candles: bars(V), market: market() });
    expect(r.trades).toHaveLength(1);
    const t = r.trades[0];
    expect(t.entryIndex).toBe(7);
    expect(t.entryPrice).toBe(10);
    expect(t.exitIndex).toBe(12);
    expect(t.exitPrice).toBe(12);
    expect(t.exitReason).toBe("signal");
    expect(t.daysHeld).toBe(5);
    expect(t.pricePnlUsd).toBeCloseTo(40);
    expect(t.fees.openUsd).toBeCloseTo(0.2);
    expect(t.fees.oracleUsd).toBeCloseTo(1.0);
    expect(t.fees.rolloverUsd).toBeCloseTo(0.3);
    expect(t.fees.totalUsd).toBeCloseTo(1.5);
    expect(t.netPnlUsd).toBeCloseTo(38.5);
    expect(r.strategy.finalEquityUsd).toBeCloseTo(138.5);
    expect(r.strategy.returnPct).toBeCloseTo(38.5);
    expect(r.strategy.winRatePct).toBe(100);
    expect(r.strategy.feesUsd).toBeCloseTo(1.5);
    // Peak at close 15: 100 − 0.82 + 100 = 199.18; trough at the end 138.50.
    expect(r.strategy.maxDrawdownPct).toBeCloseTo(((199.18 - 138.5) / 199.18) * 100, 2);
    // Buy and hold: warm-up 3, enters open[4] = 9, exits close[13] = 9, 9 days of rollover.
    expect(r.buyAndHold.trade?.entryPrice).toBe(9);
    expect(r.buyAndHold.trade?.exitPrice).toBe(9);
    expect(r.buyAndHold.trade?.daysHeld).toBe(9);
    expect(r.buyAndHold.feesUsd).toBeCloseTo(1.74);
    expect(r.buyAndHold.returnPct).toBeCloseTo(-1.74);
    expect(r.skipped).toHaveLength(0);
  });

  it("take profit fills inside the bar", () => {
    const candles = bars([10, 10, 10, 11, 11.5]);
    candles[4].high = 11.6;
    const r = runBacktest({ spec: spec({ entry: { kind: "breakout", lookback: 2 }, exit: { takeProfitPct: 5 } }), candles, market: market() });
    expect(r.trades).toHaveLength(1);
    const t = r.trades[0];
    expect(t.entryPrice).toBe(11);
    expect(t.exitReason).toBe("take-profit");
    expect(t.exitPrice).toBeCloseTo(11.55);
    expect(t.pricePnlUsd).toBeCloseTo(10);
    expect(t.daysHeld).toBe(0);
    expect(t.fees.totalUsd).toBeCloseTo(1.2);
    expect(t.netPnlUsd).toBeCloseTo(8.8);
  });

  it("stop loss fills inside the bar, and wins over a take profit in the same bar", () => {
    const build = (high: number) => {
      const candles = bars([10, 10, 10, 11, 11.5]);
      candles[4].low = 9.5;
      candles[4].high = high;
      return candles;
    };
    for (const high of [11.5, 11.6]) {
      const r = runBacktest({
        spec: spec({ entry: { kind: "breakout", lookback: 2 }, exit: { takeProfitPct: 5, stopLossPct: 10 } }),
        candles: build(high),
        market: market(),
      });
      expect(r.trades).toHaveLength(1);
      expect(r.trades[0].exitReason).toBe("stop-loss");
      expect(r.trades[0].exitPrice).toBeCloseTo(9.9);
      expect(r.trades[0].pricePnlUsd).toBeCloseTo(-20);
      expect(r.trades[0].netPnlUsd).toBeCloseTo(-21.2);
    }
  });

  it("a gap through the stop fills at the open and charges the day", () => {
    const candles = bars([10, 10, 10, 11, 11, 8]);
    candles[5].open = 8; // opens below the 9.9 stop
    candles[5].high = 8;
    const r = runBacktest({ spec: spec({ entry: { kind: "breakout", lookback: 2 }, exit: { stopLossPct: 10 } }), candles, market: market() });
    expect(r.trades).toHaveLength(1);
    const t = r.trades[0];
    expect(t.exitReason).toBe("stop-loss");
    expect(t.exitPrice).toBe(8);
    expect(t.daysHeld).toBe(1);
    expect(t.pricePnlUsd).toBeCloseTo((200 * (8 - 11)) / 11);
    expect(t.netPnlUsd).toBeCloseTo((200 * (8 - 11)) / 11 - 0.2 - 1.0 - 0.06);
  });

  it("liquidation loses the collateral and pays no closing oracle fee", () => {
    const candles = bars([10, 10, 10, 11, 6]);
    candles[4].low = 5;
    const r = runBacktest({ spec: spec({ entry: { kind: "breakout", lookback: 2 } }), candles, market: market() });
    const t = r.trades[0];
    expect(t.exitReason).toBe("liquidation");
    expect(t.liquidationPrice).toBeCloseTo(6.05);
    expect(t.pricePnlUsd).toBe(-100);
    expect(t.fees.oracleUsd).toBe(0.5);
    expect(t.netPnlUsd).toBeCloseTo(-100.7);
    expect(r.strategy.finalEquityUsd).toBeCloseTo(-0.7);
  });

  it("a flat series makes no trades and pays no fees, while buy-and-hold still pays", () => {
    const r = runBacktest({ spec: spec(), candles: bars(new Array(10).fill(10)), market: market() });
    expect(r.strategy.trades).toBe(0);
    expect(r.strategy.returnPct).toBe(0);
    expect(r.strategy.feesUsd).toBe(0);
    expect(r.strategy.winRatePct).toBe(0);
    expect(r.buyAndHold.trades).toBe(1);
    // enters open[4], held through index 9: 5 days
    expect(r.buyAndHold.feesUsd).toBeCloseTo(0.2 + 1.0 + 5 * 0.06);
  });

  it("the daily loss stop refuses the re-entry decided on the losing day", () => {
    const candles = bars([10, 10, 10, 11, 12, 13, 13]);
    candles[4].high = 12.5;
    candles[4].low = 9.5;
    const r = runBacktest({
      spec: spec({ entry: { kind: "breakout", lookback: 2 }, exit: { stopLossPct: 10 }, caps: { maxPositionUsd: 1000, dailyLossLimitUsd: 10 } }),
      candles,
      market: market(),
    });
    expect(r.trades[0].exitReason).toBe("stop-loss");
    expect(r.trades[0].exitIndex).toBe(4);
    expect(r.skipped).toHaveLength(1);
    expect(r.skipped[0].index).toBe(4);
    expect(r.skipped[0].refusals.map((f) => f.code)).toContain("daily-loss-stop");
    expect(r.trades).toHaveLength(2);
    expect(r.trades[1].entryIndex).toBe(6);
    expect(r.trades[1].exitReason).toBe("end");
  });

  it("leverage above the tier cap refuses every signal but buy-and-hold still reports", () => {
    const r = runBacktest({ spec: spec({ size: { collateralUsd: 100, leverage: 6 } }), candles: bars(V), market: market() });
    expect(r.trades).toHaveLength(0);
    expect(r.skipped.length).toBeGreaterThan(0);
    expect(r.skipped.every((s) => s.refusals.some((f) => f.code === "leverage-over-tier"))).toBe(true);
    expect(r.buyAndHold.trades).toBe(1);
  });

  it("buy-and-hold on a steady rise", () => {
    const r = runBacktest({ spec: spec({ entry: { kind: "breakout", lookback: 2 } }), candles: bars([10, 11, 12, 13, 14, 15, 16, 17, 18, 19]), market: market() });
    const b = r.buyAndHold.trade!;
    expect(b.entryPrice).toBe(12);
    expect(b.exitPrice).toBe(19);
    expect(b.daysHeld).toBe(6);
    expect(b.pricePnlUsd).toBeCloseTo((200 * 7) / 12);
    expect(b.fees.totalUsd).toBeCloseTo(1.56);
    expect(r.buyAndHold.returnPct).toBeCloseTo(((200 * 7) / 12 - 1.56) / 100 * 100);
  });

  it("charges rollover across a weekend gap", () => {
    const candles = bars([10, 10, 11, 11, 11], [day(0), day(1), day(2), day(3), day(6)]);
    const r = runBacktest({ spec: spec({ entry: { kind: "breakout", lookback: 2 } }), candles, market: market() });
    const t = r.trades[0];
    expect(t.entryIndex).toBe(3);
    expect(t.daysHeld).toBe(3);
    expect(t.fees.rolloverUsd).toBeCloseTo(0.18);
  });

  it("reports the history start, the window and the first tradable candle", () => {
    const candles = bars(V);
    const r = runBacktest({ spec: spec(), candles, market: market() });
    expect(r.historyStart).toBe(candles[0].time);
    expect(r.windowEnd).toBe(candles[candles.length - 1].time);
    expect(r.candleCount).toBe(candles.length);
    expect(r.warmupCandles).toBe(3);
    expect(r.firstTradableIndex).toBe(4);
    expect(r.firstTradableTime).toBe(day(4));
    expect(r.equity).toHaveLength(candles.length);
    expect(r.costs.rolloverPerDayUsd).toBeCloseTo(0.06);
  });

  it("refuses a series shorter than the warm-up plus two", () => {
    expect(() => runBacktest({ spec: spec(), candles: bars([1, 2, 3, 4]), market: market() })).toThrow(BacktestError);
  });
});
