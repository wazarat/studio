import { describe, expect, it } from "vitest";

import { highestHigh, lowestLow, rsi, signals, sma } from "@/lib/strategies/indicators";
import type { Candle } from "@/lib/venues/types";

const bars = (closes: number[]): Candle[] =>
  closes.map((close, i) => {
    const open = i === 0 ? close : closes[i - 1];
    return { time: i * 86_400_000, open, high: Math.max(open, close), low: Math.min(open, close), close };
  });

describe("sma", () => {
  it("is NaN until n values and the mean after", () => {
    const s = sma([1, 2, 3, 4], 3);
    expect(Number.isNaN(s[0])).toBe(true);
    expect(Number.isNaN(s[1])).toBe(true);
    expect(s[2]).toBeCloseTo(2);
    expect(s[3]).toBeCloseTo(3);
  });
});

describe("rsi", () => {
  it("is 100 on a pure rise, 0 on a pure fall, NaN during warm-up", () => {
    const up = rsi([1, 2, 3, 4, 5, 6], 3);
    expect(Number.isNaN(up[2])).toBe(true);
    expect(up[3]).toBe(100);
    expect(up[5]).toBe(100);
    const down = rsi([6, 5, 4, 3, 2, 1], 3);
    expect(down[3]).toBeCloseTo(0);
  });

  it("matches Wilder's smoothing on a short series", () => {
    // gains/losses over 2: [ +1, -1 ] then +3
    const r = rsi([10, 11, 10, 13], 2);
    // avgGain=0.5 avgLoss=0.5 -> 50; then gain 3: avgGain=(0.5+3)/2=1.75, avgLoss=0.25 -> 100-100/(1+7)=87.5
    expect(r[2]).toBeCloseTo(50);
    expect(r[3]).toBeCloseTo(87.5);
  });
});

describe("highestHigh / lowestLow", () => {
  it("look at the previous candles only", () => {
    const hh = highestHigh([1, 5, 2, 9], 2);
    expect(Number.isNaN(hh[1])).toBe(true);
    expect(hh[2]).toBe(5);
    expect(hh[3]).toBe(5);
    const ll = lowestLow([4, 3, 8, 1], 2);
    expect(ll[2]).toBe(3);
    expect(ll[3]).toBe(3);
  });
});

describe("signals", () => {
  it("MA cross enters on the cross up and exits on the cross down", () => {
    const s = signals({ kind: "maCross", fast: 2, slow: 3 }, bars([12, 11, 10, 9, 8, 9, 10, 13, 14, 15, 14, 12, 10, 9]));
    expect(s[6]).toBe("enter");
    expect(s[11]).toBe("exit");
    expect(s.filter(Boolean)).toHaveLength(2);
  });

  it("breakout enters above the lookback high and exits below its low", () => {
    const s = signals({ kind: "breakout", lookback: 2 }, bars([10, 10, 10, 11, 11, 9]));
    expect(s[3]).toBe("enter");
    expect(s[5]).toBe("exit");
  });

  it("RSI enters when it crosses back up through the floor", () => {
    // Fall hard, then bounce: RSI(2) goes to ~0 then jumps.
    const s = signals({ kind: "rsi", period: 2, buyBelow: 30 }, bars([10, 9, 8, 7, 9, 10]));
    expect(s[4]).toBe("enter");
  });
});
