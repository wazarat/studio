import { describe, expect, it } from "vitest";

import { activityFromBacktests } from "@/lib/strategies/activity";
import type { BacktestResult } from "@/lib/strategies/backtest";

const trade = (entryTime: number, exitTime: number) => ({
  entryIndex: 0, entryTime, entryPrice: 100, exitIndex: 1, exitTime, exitPrice: 110, exitReason: "signal" as const,
  notionalUsd: 200, collateralUsd: 100, leverage: 2, liquidationPrice: 55, daysHeld: 1, pricePnlUsd: 20,
  fees: { openUsd: 0.2, oracleUsd: 1, rolloverUsd: 0.06, builderUsd: 0, totalUsd: 1.26 }, netPnlUsd: 18.74,
});

function result(trades: ReturnType<typeof trade>[], skippedAt: number[]): BacktestResult {
  return { trades, skipped: skippedAt.map((t) => ({ index: 0, time: t, refusals: [{ code: "leverage-over-tier", message: "Too much leverage." }] })) } as unknown as BacktestResult;
}

describe("activityFromBacktests", () => {
  it("lists entries, exits and refusals newest first, capped, tagged backtest", () => {
    const strategies = [{ id: "a", name: "A", symbol: "BTC/USD" }, { id: "b", name: "B", symbol: "ETH/USD" }];
    const results = new Map([
      ["a", result([trade(1, 5), trade(10, 12)], [7])],
      ["b", result([trade(3, 4)], [])],
    ]);
    const feed = activityFromBacktests(strategies, results);
    expect(feed.map((e) => e.time)).toEqual([12, 10, 7, 5, 4, 3, 1]);
    expect(feed[0].kind).toBe("exit");
    expect(feed[2].kind).toBe("refused");
    expect(feed.every((e) => e.source === "backtest")).toBe(true);
    expect(activityFromBacktests(strategies, results, 3)).toHaveLength(3);
  });
});
