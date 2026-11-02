import { describe, expect, it } from "vitest";

import type { PriceComparison } from "@/lib/chainlink/compare";
import { checkRisk, LIMITED_BELOW_USD, maxSizeNowUsd, type OpenRiskInput, type RiskCode } from "@/lib/risk/check";

/**
 * Every cap in the brief, proven: trades outside a cap are refused, closes
 * are never blocked, and the Chainlink findings only block on mainnet.
 */

function comparison(overrides: Partial<PriceComparison> = {}): PriceComparison {
  return {
    symbol: "BTC/USD",
    venueMid: 100_000,
    referencePrice: 100_000,
    deviationBps: 0,
    ageSeconds: 30,
    fresh: true,
    withinTolerance: true,
    ...overrides,
  };
}

function open(overrides: Partial<OpenRiskInput> = {}): OpenRiskInput {
  const base: OpenRiskInput = {
    kind: "open",
    tier: "studio",
    testnet: false,
    intent: { marketId: "0", side: "long", collateralUsd: 50, leverage: 2, orderType: "market" },
    market: {
      symbol: "BTC/USD",
      limits: {
        minNotionalUsd: 5,
        maxNotionalLongUsd: 1_000_000,
        maxNotionalShortUsd: 1_000_000,
        minLeverage: 1,
        maxLeverage: 50,
        overnightMaxLeverage: 0,
        maxSizeNowUsd: 1_000,
      },
      openInterest: { longUsd: 400_000, shortUsd: 100_000, maxPerSideUsd: 500_000 },
      hours: { isOpen: true, isDayTradingClosed: false, secondsToToggleDayTrading: null, checkedAt: 0 },
    },
    sizeUsd: 100,
    strategy: { strategyId: "s1", openNotionalUsd: 0, dailyLossLimitUsd: 100, lossTodayUsd: 0 },
    reference: comparison(),
  };
  return {
    ...base,
    ...overrides,
    intent: { ...base.intent, ...overrides.intent },
    market: {
      ...base.market,
      ...overrides.market,
      limits: { ...base.market.limits, ...overrides.market?.limits },
      openInterest: { ...base.market.openInterest, ...overrides.market?.openInterest },
      hours: { ...base.market.hours, ...overrides.market?.hours },
    },
    strategy: { ...base.strategy, ...overrides.strategy },
  };
}

function codes(input: OpenRiskInput): RiskCode[] {
  return checkRisk(input).refusals.map((f) => f.code);
}

describe("checkRisk", () => {
  it("passes a small open inside every cap", () => {
    const result = checkRisk(open());
    expect(result.ok).toBe(true);
    expect(result.refusals).toEqual([]);
    expect(result.notes).toEqual([]);
    expect(result.applied.maxLeverage).toBe(5);
  });

  it("never blocks a close", () => {
    expect(checkRisk({ kind: "close" }).ok).toBe(true);
    expect(checkRisk({ kind: "close" }).refusals).toEqual([]);
  });

  describe("leverage", () => {
    it("caps Studio at 5x", () => {
      expect(codes(open({ intent: { leverage: 5 } as never }))).toEqual([]);
      expect(codes(open({ intent: { leverage: 5.01 } as never }))).toContain("leverage-over-tier");
      expect(codes(open({ intent: { leverage: 6 } as never }))).toContain("leverage-over-tier");
    });

    it("caps Studio+ at 15x", () => {
      expect(codes(open({ tier: "studio-plus", intent: { leverage: 6 } as never }))).toEqual([]);
      expect(codes(open({ tier: "studio-plus", intent: { leverage: 15 } as never }))).toEqual([]);
      expect(codes(open({ tier: "studio-plus", intent: { leverage: 16 } as never }))).toContain("leverage-over-tier");
    });

    it("uses the market's own limit when it is lower", () => {
      const input = open({ tier: "studio-plus", intent: { leverage: 11 } as never, market: { limits: { maxLeverage: 10 } } as never });
      expect(codes(input)).toContain("leverage-over-market");
      expect(checkRisk(input).applied.maxLeverage).toBe(10);
    });

    it("applies the overnight limit unless it is a day trade in the day window", () => {
      const overnight = { limits: { overnightMaxLeverage: 3 } } as never;
      expect(codes(open({ intent: { leverage: 4 } as never, market: overnight }))).toContain("leverage-over-overnight");
      expect(codes(open({ intent: { leverage: 4, isDayTrade: true } as never, market: overnight }))).toEqual([]);
      const closedWindow = { limits: { overnightMaxLeverage: 3 }, hours: { isDayTradingClosed: true } } as never;
      expect(codes(open({ intent: { leverage: 4, isDayTrade: true } as never, market: closedWindow }))).toContain(
        "leverage-over-overnight",
      );
      expect(codes(open({ intent: { leverage: 3 } as never, market: overnight }))).toEqual([]);
    });
  });

  describe("size", () => {
    it("caps total open notional per strategy at $1,000", () => {
      expect(codes(open({ sizeUsd: 1_000 }))).toEqual([]);
      expect(codes(open({ sizeUsd: 1_000.01 }))).toContain("size-over-strategy-cap");
      expect(codes(open({ sizeUsd: 2, strategy: { openNotionalUsd: 999 } as never }))).toContain("size-over-strategy-cap");
      expect(codes(open({ sizeUsd: 1, strategy: { openNotionalUsd: 999 } as never }))).toEqual([]);
    });

    it("caps a trade at 1% of the remaining open interest on its side", () => {
      // 500,000 max, 400,000 long → 100,000 left → 1,000 allowed.
      expect(codes(open({ sizeUsd: 1_000 }))).toEqual([]);
      expect(codes(open({ sizeUsd: 1_000.01 }))).toContain("size-over-oi-share");
      // The short side has 400,000 left → 4,000 allowed, but the strategy cap still holds.
      const short = open({ sizeUsd: 1_000, intent: { side: "short" } as never });
      expect(codes(short)).toEqual([]);
      expect(checkRisk(short).applied.remainingOiUsd).toBe(400_000);
    });

    it("refuses anything on a full side", () => {
      expect(codes(open({ sizeUsd: 5, market: { openInterest: { longUsd: 500_000 } } as never }))).toContain("size-over-oi-share");
    });
  });

  describe("daily loss stop", () => {
    it("refuses once today's loss reaches the limit", () => {
      expect(codes(open({ strategy: { lossTodayUsd: 99.99 } as never }))).toEqual([]);
      expect(codes(open({ strategy: { lossTodayUsd: 100 } as never }))).toContain("daily-loss-stop");
      expect(codes(open({ strategy: { lossTodayUsd: 250 } as never }))).toContain("daily-loss-stop");
    });

    it("is off when the limit is 0", () => {
      expect(codes(open({ strategy: { dailyLossLimitUsd: 0, lossTodayUsd: 1_000 } as never }))).toEqual([]);
    });
  });

  describe("Chainlink reference", () => {
    it("refuses a stale reading on mainnet and notes it on testnet", () => {
      const stale = comparison({ fresh: false, ageSeconds: 7_200 });
      expect(codes(open({ reference: stale }))).toContain("reference-stale");
      const testnet = checkRisk(open({ reference: stale, testnet: true }));
      expect(testnet.ok).toBe(true);
      expect(testnet.notes.map((n) => n.code)).toContain("reference-stale");
    });

    it("refuses a deviation outside the band on mainnet and notes it on testnet", () => {
      const off = comparison({ deviationBps: 80, withinTolerance: false });
      expect(codes(open({ reference: off }))).toContain("reference-deviation");
      const testnet = checkRisk(open({ reference: off, testnet: true }));
      expect(testnet.ok).toBe(true);
      expect(testnet.notes.map((n) => n.code)).toContain("reference-deviation");
    });

    it("skips a market with no feed, noting it, on both networks", () => {
      for (const testnet of [false, true]) {
        const result = checkRisk(open({ reference: null, testnet }));
        expect(result.ok).toBe(true);
        expect(result.notes.map((n) => n.code)).toEqual(["reference-missing"]);
      }
    });

    it("still enforces every other cap on testnet", () => {
      expect(codes(open({ testnet: true, intent: { leverage: 6 } as never }))).toContain("leverage-over-tier");
    });
  });

  it("max size now is exactly what the open-interest rule allows", () => {
    // 100,000 left on the long side → 1% = 1,000, within a 1,000,000 pair room.
    expect(maxSizeNowUsd(100_000, 1_000_000)).toBe(1_000);
    expect(codes(open({ sizeUsd: 1_000 }))).toEqual([]);
    expect(codes(open({ sizeUsd: 1_000.01 }))).toContain("size-over-oi-share");
    // The pair's own room can be the tighter bound; a full side gives zero and is "limited".
    expect(maxSizeNowUsd(100_000, 600)).toBe(600);
    expect(maxSizeNowUsd(-5_000, 1_000_000)).toBe(0);
    expect(maxSizeNowUsd(4_000, 1_000_000)).toBeLessThan(LIMITED_BELOW_USD);
  });

  it("refuses a closed market", () => {
    expect(codes(open({ market: { hours: { isOpen: false } } as never }))).toContain("market-closed");
  });

  it("reports every violation at once", () => {
    const result = checkRisk(
      open({
        intent: { leverage: 20 } as never,
        sizeUsd: 5_000,
        strategy: { lossTodayUsd: 500 } as never,
        reference: comparison({ fresh: false, withinTolerance: false }),
        market: { hours: { isOpen: false } } as never,
      }),
    );
    expect(result.ok).toBe(false);
    expect(result.refusals.map((f) => f.code).sort()).toEqual(
      [
        "daily-loss-stop",
        "leverage-over-tier",
        "market-closed",
        "reference-deviation",
        "reference-stale",
        "size-over-oi-share",
        "size-over-strategy-cap",
      ].sort(),
    );
  });

  it("accepts custom limits", () => {
    const input = open({ sizeUsd: 1_500, limits: { maxPositionUsdPerStrategy: 2_000, maxOiShareBps: 200 } });
    expect(codes(input)).toEqual([]);
  });
});
