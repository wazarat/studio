import { afterAll, describe, expect, it } from "vitest";

import { getDb } from "@/lib/db";
import { runBacktest } from "@/lib/strategies/backtest";
import { completedDailyCandles, ostiumDailyCandles } from "@/lib/strategies/candles";
import { getStrategy, insertBacktest, insertStrategy, latestBacktest, latestBacktests, listStrategies, lossTodayUsd } from "@/lib/strategies/db";
import { StrategySpecSchema } from "@/lib/strategies/spec";
import { ostium } from "@/lib/venues/ostium";

/**
 * The save, reload and rerun path (Studio step 4) through the same modules
 * the pages use, against the real database and real Ostium candles. Opt in
 * with OSTIUM_SMOKE=1 and DATABASE_URL set; it cleans up its own rows.
 *
 *   OSTIUM_SMOKE=1 node --env-file=.env.local node_modules/vitest/vitest.mjs run lib/strategies/flow.smoke.test.ts
 */
const enabled = process.env.OSTIUM_SMOKE === "1" && Boolean(process.env.DATABASE_URL);
const OWNER = "smoke-test-owner";

describe.skipIf(!enabled)("strategy flow", () => {
  afterAll(async () => {
    const sql = getDb();
    if (sql) await sql`delete from studio.strategies where owner_id = ${OWNER}`;
  });

  it("saves a strategy, stores a backtest, reads both back, and reruns", async () => {
    const market = (await ostium.markets()).find((m) => m.id === "0")!;
    const spec = StrategySpecSchema.parse({
      id: crypto.randomUUID(),
      name: "Smoke BTC 10/30",
      market: { venue: "ostium", marketId: "0", symbol: market.symbol },
      direction: "long",
      entry: { kind: "maCross", fast: 10, slow: 30 },
      exit: { stopLossPct: 8 },
      size: { collateralUsd: 100, leverage: 2 },
      wake: { kind: "candle-close", resolution: "1D" },
      caps: { maxPositionUsd: 1000, dailyLossLimitUsd: 50 },
      tier: "studio",
      status: "draft",
    });

    const saved = await insertStrategy(OWNER, spec);
    expect(saved.id).toBe(spec.id);
    expect(saved.spec).toEqual(spec);
    expect(await lossTodayUsd(spec.id)).toBe(0);

    const candles = await completedDailyCandles(ostiumDailyCandles, "0");
    const results = runBacktest({ spec, candles, market });
    const stored = await insertBacktest(spec.id, {
      spec,
      market,
      source: "ostium daily",
      candleCount: candles.length,
      windowStart: results.windowStart,
      windowEnd: results.windowEnd,
      ranAt: Date.now(),
    }, results);
    expect(stored.historyStart.slice(0, 10)).toBe("2024-01-01");

    // "After a reload": fresh reads by id and by owner.
    const again = await getStrategy(spec.id, OWNER);
    expect(again?.name).toBe("Smoke BTC 10/30");
    expect(await getStrategy(spec.id, "someone-else")).toBeNull();
    const latest = await latestBacktest(spec.id);
    expect(latest?.results.strategy.trades).toBe(results.strategy.trades);
    expect(latest?.results.historyStart).toBe(results.historyStart);
    const listed = await listStrategies(OWNER);
    expect(listed.map((s) => s.id)).toContain(spec.id);
    expect((await latestBacktests([spec.id])).get(spec.id)?.id).toBe(stored.id);

    // Rerun: a newer row becomes the latest.
    const rerun = await insertBacktest(spec.id, { spec, market, source: "ostium daily", candleCount: candles.length, windowStart: results.windowStart, windowEnd: results.windowEnd, ranAt: Date.now() }, results);
    expect((await latestBacktest(spec.id))?.id).toBe(rerun.id);
    console.log(`[smoke] saved ${spec.id}, backtest ${results.strategy.trades} trades, ${results.strategy.returnPct.toFixed(1)}% vs hold ${results.buyAndHold.returnPct.toFixed(1)}%, history from ${new Date(results.historyStart).toISOString().slice(0, 10)}`);
  }, 120_000);
});
