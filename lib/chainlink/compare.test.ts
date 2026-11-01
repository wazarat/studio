import { describe, expect, it } from "vitest";

import {
  compareToReference,
  deviationBps,
  isFresh,
  type ChainlinkReading,
} from "@/lib/chainlink/compare";

function reading(overrides: Partial<ChainlinkReading> = {}): ChainlinkReading {
  return {
    symbol: "BTC/USD",
    feed: "0x0000000000000000000000000000000000000001",
    price: 100_000,
    updatedAt: 1_700_000_000,
    ageSeconds: 60,
    heartbeatSeconds: 3600,
    fresh: true,
    ...overrides,
  };
}

describe("deviationBps", () => {
  it("is signed and in basis points", () => {
    expect(deviationBps(100_500, 100_000)).toBeCloseTo(50);
    expect(deviationBps(99_500, 100_000)).toBeCloseTo(-50);
    expect(deviationBps(100_000, 100_000)).toBe(0);
  });

  it("is infinite without a usable reference", () => {
    expect(deviationBps(100, 0)).toBe(Number.POSITIVE_INFINITY);
    expect(deviationBps(Number.NaN, 100)).toBe(Number.POSITIVE_INFINITY);
  });
});

describe("isFresh", () => {
  it("allows the heartbeat plus grace and no more", () => {
    expect(isFresh(3600, 3600)).toBe(true);
    expect(isFresh(3600 + 15 * 60, 3600)).toBe(true);
    expect(isFresh(3600 + 15 * 60 + 1, 3600)).toBe(false);
    expect(isFresh(-5, 3600)).toBe(false);
  });
});

describe("compareToReference", () => {
  it("passes inside the band", () => {
    const c = compareToReference(100_040, reading(), 50);
    expect(c.withinTolerance).toBe(true);
    expect(c.deviationBps).toBeCloseTo(4);
    expect(c.fresh).toBe(true);
  });

  it("fails just outside the band on either side", () => {
    expect(compareToReference(100_501, reading(), 50).withinTolerance).toBe(false);
    expect(compareToReference(99_499, reading(), 50).withinTolerance).toBe(false);
    expect(compareToReference(100_500, reading(), 50).withinTolerance).toBe(true);
  });

  it("carries staleness through untouched", () => {
    const c = compareToReference(100_000, reading({ fresh: false, ageSeconds: 90_000 }));
    expect(c.fresh).toBe(false);
    expect(c.ageSeconds).toBe(90_000);
    expect(c.withinTolerance).toBe(true);
  });
});
