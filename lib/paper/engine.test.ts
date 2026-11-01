import { describe, expect, it } from "vitest";

import { candleDateOf, closeNumbers, dateFromDb, daysBetween, decideExit, isDue, planEntry, rolloverDue, signalOn, unrealised, utcDate } from "@/lib/paper/engine";
import type { PaperPosition, PaperStrategy } from "@/lib/paper/store";
import type { Candle } from "@/lib/venues/types";

const DAY = 86_400_000;
const day = (k: number) => Date.UTC(2026, 9, 1) + k * DAY;
const bars = (closes: number[]): Candle[] =>
  closes.map((close, i) => {
    const open = i === 0 ? close : closes[i - 1];
    return { time: day(i), open, high: Math.max(open, close), low: Math.min(open, close), close };
  });
const market = { fees: { openBps: 10, closeBps: 0, oracleFeeUsd: 0.5 }, rollover8h: { long: 0.01, short: 0.01 } };
const strategy: PaperStrategy = {
  id: "s1",
  ownerId: "u1",
  name: "BTC breakout 2",
  symbol: "BTC/USD",
  marketId: "0",
  status: "paper",
  paperSince: day(3) + 12 * 3_600_000,
  spec: {
    id: "s1",
    name: "BTC breakout 2",
    market: { venue: "ostium", marketId: "0", symbol: "BTC/USD" },
    direction: "long",
    entry: { kind: "breakout", lookback: 2 },
    exit: { takeProfitPct: 5, stopLossPct: 10 },
    size: { collateralUsd: 100, leverage: 2 },
    wake: { kind: "candle-close", resolution: "1D" },
    caps: { maxPositionUsd: 1000, dailyLossLimitUsd: 0 },
    tier: "studio",
    status: "paper",
  },
};

function position(over: Partial<PaperPosition> = {}): PaperPosition {
  return { ...planEntry(strategy, 11.1, market, utcDate(day(3)), day(4) + 120_000), id: "p1", closedAt: null, ...over };
}

describe("dates", () => {
  it("keys the candle date on the last candle, not the clock", () => {
    const cd = candleDateOf(bars([10, 10, 10, 11]))!;
    expect(cd.date).toBe("2026-10-04");
    expect(cd.closeMs).toBe(day(4));
    expect(candleDateOf([])).toBeNull();
    expect(daysBetween("2026-10-03", "2026-10-06")).toBe(3);
  });

  it("the latest candle at start is due; anything older is not", () => {
    expect(isDue(day(4), day(4) - 1)).toBe(true);
    expect(isDue(day(4), day(4) + 12 * 3_600_000)).toBe(true); // started mid-day: yesterday's close counts
    expect(isDue(day(4), day(5))).toBe(false); // a candle that closed a full day before the start does not
    expect(isDue(day(4), day(5) + 1)).toBe(false);
    expect(isDue(day(4), null)).toBe(true);
  });
});

describe("dateFromDb", () => {
  it("recovers the day from a local-midnight Date or a string", () => {
    expect(dateFromDb(new Date(2026, 9, 31))).toBe("2026-10-31");
    expect(dateFromDb("2026-10-31")).toBe("2026-10-31");
    expect(dateFromDb("2026-10-31T00:00:00.000Z")).toBe("2026-10-31");
  });
});

describe("signalOn", () => {
  it("reads the last candle and stays quiet during warm-up", () => {
    expect(signalOn({ kind: "breakout", lookback: 2 }, bars([10, 10, 10, 11]))).toBe("enter");
    expect(signalOn({ kind: "breakout", lookback: 2 }, bars([10, 11]))).toBeNull();
  });
});

describe("planEntry", () => {
  it("prices the entry at the ask with the engine's costs and levels", () => {
    const p = planEntry(strategy, 11.1, market, "2026-10-04", day(4) + 120_000);
    expect(p.notionalUsd).toBe(200);
    expect(p.liquidationPrice).toBeCloseTo(11.1 * 0.55);
    expect(p.takeProfit).toBeCloseTo(11.655);
    expect(p.stopLoss).toBeCloseTo(9.99);
    expect(p.openFeeUsd).toBeCloseTo(0.2);
    expect(p.oracleFeeUsd).toBe(0.5);
    expect(p.rolloverPerDayUsd).toBeCloseTo(0.06);
    expect(p.rolloverThrough).toBe("2026-10-05");
    expect(p.entryCandleDate).toBe("2026-10-04");
  });
});

describe("decideExit", () => {
  it("checks the downside first, then the target, then a pending stop", () => {
    const p = position();
    expect(decideExit(p, 9.0, false)).toBe("stop-loss");
    expect(decideExit(p, 5.4, false)).toBe("liquidation");
    expect(decideExit(p, 11.7, false)).toBe("take-profit");
    expect(decideExit(p, 11.0, false)).toBeNull();
    expect(decideExit(p, 11.0, true)).toBe("stopped");
    expect(decideExit(position({ stopLoss: 5.0 }), 5.4, false)).toBe("liquidation");
  });
});

describe("closeNumbers and unrealised", () => {
  it("matches the backtest's close arithmetic", () => {
    const p = position({ rolloverUsd: 0.06 });
    const signal = closeNumbers(p, 12.21, "signal");
    expect(signal.pricePnlUsd).toBeCloseTo(20);
    expect(signal.feesUsd).toBeCloseTo(0.2 + 1.0 + 0.06);
    expect(signal.realisedPnlUsd).toBeCloseTo(20 - 1.26);
    const liq = closeNumbers(position(), 5.4, "liquidation");
    expect(liq.pricePnlUsd).toBe(-100);
    expect(liq.feesUsd).toBeCloseTo(0.7);
    expect(liq.realisedPnlUsd).toBeCloseTo(-100.7);
    expect(unrealised(position(), 12.21)).toBeCloseTo(20 - 0.7);
  });

  it("charges rollover for the calendar days since the last accrual", () => {
    const r = rolloverDue(position({ rolloverThrough: "2026-10-05" }), "2026-10-08");
    expect(r.days).toBe(3);
    expect(r.chargeUsd).toBeCloseTo(0.18);
    expect(rolloverDue(position({ rolloverThrough: "2026-10-05" }), "2026-10-05").days).toBe(0);
  });
});
