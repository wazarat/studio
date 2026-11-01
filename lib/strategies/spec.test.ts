import { describe, expect, it } from "vitest";

import { StrategySpecSchema, warmupCandles } from "@/lib/strategies/spec";

const base = {
  id: "s1",
  name: "Test",
  market: { venue: "ostium", marketId: "0", symbol: "BTC/USD" },
  direction: "long",
  entry: { kind: "maCross", fast: 10, slow: 30 },
  exit: {},
  size: { collateralUsd: 100, leverage: 2 },
  wake: { kind: "candle-close", resolution: "1D" },
  caps: { maxPositionUsd: 1000, dailyLossLimitUsd: 50 },
  tier: "studio",
  status: "draft",
};

describe("StrategySpecSchema", () => {
  it("accepts the base spec", () => {
    expect(StrategySpecSchema.safeParse(base).success).toBe(true);
  });

  it("stores direction but only accepts long for now", () => {
    const r = StrategySpecSchema.safeParse({ ...base, direction: "short" });
    expect(r.success).toBe(false);
    expect(StrategySpecSchema.safeParse({ ...base, direction: "sideways" }).success).toBe(false);
  });

  it("needs the fast average shorter than the slow one", () => {
    expect(StrategySpecSchema.safeParse({ ...base, entry: { kind: "maCross", fast: 30, slow: 30 } }).success).toBe(false);
    expect(StrategySpecSchema.safeParse({ ...base, entry: { kind: "maCross", fast: 5, slow: 30 } }).success).toBe(true);
  });

  it("refuses a stop loss past the liquidation price", () => {
    // At 2x, liquidation sits 45% below entry.
    expect(StrategySpecSchema.safeParse({ ...base, exit: { stopLossPct: 45 } }).success).toBe(false);
    expect(StrategySpecSchema.safeParse({ ...base, exit: { stopLossPct: 44 } }).success).toBe(true);
    expect(StrategySpecSchema.safeParse({ ...base, size: { collateralUsd: 100, leverage: 10 }, exit: { stopLossPct: 9 } }).success).toBe(false);
  });

  it("caps the strategy size field at $1,000 and only knows daily candle-close wakes", () => {
    expect(StrategySpecSchema.safeParse({ ...base, caps: { maxPositionUsd: 1001, dailyLossLimitUsd: 0 } }).success).toBe(false);
    expect(StrategySpecSchema.safeParse({ ...base, wake: { kind: "candle-close", resolution: "60" } }).success).toBe(false);
  });

  it("knows each rule's warm-up", () => {
    expect(warmupCandles({ kind: "maCross", fast: 2, slow: 3 })).toBe(3);
    expect(warmupCandles({ kind: "rsi", period: 14, buyBelow: 30 })).toBe(15);
    expect(warmupCandles({ kind: "breakout", lookback: 20 })).toBe(20);
  });
});
