import { describe, expect, it } from "vitest";

import { runBacktest, type MarketSnapshot } from "@/lib/strategies/backtest";
import { markersFor, overlaysFor, paneFor, toChartTime } from "@/lib/strategies/chart-data";
import type { StrategySpec } from "@/lib/strategies/spec";
import type { Candle } from "@/lib/venues/types";

const DAY = 86_400_000;
const bars = (closes: number[]): Candle[] =>
  closes.map((close, i) => {
    const open = i === 0 ? close : closes[i - 1];
    return { time: Date.UTC(2024, 0, 1) + i * DAY, open, high: Math.max(open, close), low: Math.min(open, close), close };
  });

const market: MarketSnapshot = {
  symbol: "BTC/USD",
  limits: { minNotionalUsd: 5, maxNotionalLongUsd: 1e6, maxNotionalShortUsd: 1e6, minLeverage: 1, maxLeverage: 50, overnightMaxLeverage: 0, maxSizeNowUsd: 5_000 },
  openInterest: { longUsd: 0, shortUsd: 0, maxPerSideUsd: 500_000 },
  hours: { isOpen: true, isDayTradingClosed: false, secondsToToggleDayTrading: null, checkedAt: 0 },
  fees: { openBps: 10, closeBps: 0, oracleFeeUsd: 0.5 },
  rollover8h: { long: 0.01, short: 0.01 },
};
const spec: StrategySpec = {
  id: "s",
  name: "t",
  market: { venue: "ostium", marketId: "0", symbol: "BTC/USD" },
  direction: "long",
  entry: { kind: "maCross", fast: 2, slow: 3 },
  exit: {},
  size: { collateralUsd: 100, leverage: 2 },
  wake: { kind: "candle-close", resolution: "1D" },
  caps: { maxPositionUsd: 1000, dailyLossLimitUsd: 0 },
  tier: "studio",
  status: "draft",
};

describe("toChartTime", () => {
  it("is the UTC day", () => {
    expect(toChartTime(Date.UTC(2024, 0, 1))).toBe("2024-01-01");
    expect(toChartTime(Date.UTC(2024, 0, 1, 13))).toBe("2024-01-01");
  });
});

describe("overlaysFor / paneFor", () => {
  it("draws the engine's own averages with NaN during warm-up", () => {
    const o = overlaysFor({ kind: "maCross", fast: 2, slow: 3 }, bars([1, 2, 3, 4]));
    expect(o.map((x) => x.key)).toEqual(["fast", "slow"]);
    expect(Number.isNaN(o[1].values[1])).toBe(true);
    expect(o[1].values[3]).toBeCloseTo(3);
    expect(paneFor({ kind: "maCross", fast: 2, slow: 3 }, bars([1, 2, 3]))).toBeNull();
  });

  it("gives RSI its own pane with the entry and exit levels", () => {
    const p = paneFor({ kind: "rsi", period: 2, buyBelow: 25 }, bars([1, 2, 3, 4]))!;
    expect(p.lines.map((l) => l.value)).toEqual([25, 75]);
    expect(p.values).toHaveLength(4);
  });
});

describe("markersFor", () => {
  it("places every marker on a candle time, sorted", () => {
    const candles = bars([12, 11, 10, 9, 8, 9, 10, 13, 14, 15, 14, 12, 10, 9]);
    const r = runBacktest({ spec, candles, market });
    const m = markersFor(r);
    const times = new Set(candles.map((c) => c.time));
    expect(m.length).toBe(2);
    expect(m.every((x) => times.has(x.time))).toBe(true);
    expect(m[0].kind).toBe("entry");
    expect(m[1].text).toBe("signal");
    for (let i = 1; i < m.length; i++) expect(m[i].time).toBeGreaterThanOrEqual(m[i - 1].time);
  });
});
