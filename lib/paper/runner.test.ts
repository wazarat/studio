import { describe, expect, it } from "vitest";

import { DAY_MS, utcDate } from "@/lib/paper/engine";
import { closeForStop, runTick } from "@/lib/paper/runner";
import { MemoryPaperStore } from "@/lib/paper/store-memory";
import type { PaperStrategy, TickDeps } from "@/lib/paper/store";
import type { Candle, Market, Price } from "@/lib/venues/types";

/**
 * Paper runs against the in-memory store with fake prices and candles.
 * Fees as in the backtest tests: $200 notional, 0.20 open, 0.50 oracle,
 * 0.06 rollover per day.
 */
const day = (k: number) => Date.UTC(2026, 9, 1) + k * DAY_MS;
const at = (k: number, hours: number) => day(k) + hours * 3_600_000;
const bars = (closes: number[]): Candle[] =>
  closes.map((close, i) => {
    const open = i === 0 ? close : closes[i - 1];
    return { time: day(i), open, high: Math.max(open, close), low: Math.min(open, close), close };
  });

function market(over: Partial<Market> = {}): Market {
  return {
    venue: "ostium",
    id: "0",
    symbol: "BTC/USD",
    base: "BTC",
    quote: "USD",
    category: "crypto",
    limits: { minNotionalUsd: 5, maxNotionalLongUsd: 1e6, maxNotionalShortUsd: 1e6, minLeverage: 1, maxLeverage: 50, overnightMaxLeverage: 0 },
    openInterest: { longUsd: 0, shortUsd: 0, maxPerSideUsd: 5_000_000 },
    fees: { openBps: 10, closeBps: 0, oracleFeeUsd: 0.5 },
    rollover8h: { long: 0.01, short: 0.01 },
    hours: { isOpen: true, isDayTradingClosed: false, secondsToToggleDayTrading: null, checkedAt: 0 },
    ...over,
  };
}

function strategy(over: Omit<Partial<PaperStrategy>, "spec"> & { spec?: Partial<PaperStrategy["spec"]> } = {}): PaperStrategy {
  const { spec, ...rest } = over;
  return {
    id: "s1",
    ownerId: "u1",
    name: "BTC breakout 2",
    symbol: "BTC/USD",
    marketId: "0",
    status: "paper",
    paperSince: at(3, 12),
    ...rest,
    spec: {
      id: over.id ?? "s1",
      name: "BTC breakout 2",
      market: { venue: "ostium", marketId: "0", symbol: "BTC/USD" },
      direction: "long",
      entry: { kind: "breakout", lookback: 2 },
      exit: {},
      size: { collateralUsd: 100, leverage: 2 },
      wake: { kind: "candle-close", resolution: "1D" },
      caps: { maxPositionUsd: 1000, dailyLossLimitUsd: 0 },
      tier: "studio",
      status: "paper",
      ...spec,
    },
  };
}

interface World {
  store: MemoryPaperStore;
  price: Price;
  candles: Candle[];
  deps: TickDeps;
}

function world(strategies: PaperStrategy[], closes: number[], m: Market = market()): World {
  const store = new MemoryPaperStore(strategies);
  const w: World = {
    store,
    price: { marketId: "0", symbol: "BTC/USD", bid: 10.9, mid: 11, ask: 11.1, isOpen: true, at: 0 },
    candles: bars(closes),
    deps: {
      store,
      prices: { prices: async () => [w.price] },
      markets: async () => [m],
      candles: async (_id, nowMs) => w.candles.filter((c) => c.time < Math.floor(nowMs / DAY_MS) * DAY_MS),
      testnet: true,
    },
  };
  return w;
}

const kinds = (w: World) => w.store.activity.map((a) => a.kind);

describe("runTick", () => {
  it("opens once on an enter signal however many times the tick runs, then exits on the exit signal", async () => {
    const w = world([strategy()], [10, 10, 10, 11]);
    const r1 = await runTick(w.deps, at(4, 0.05));
    expect(r1.entries).toBe(1);
    const r2 = await runTick(w.deps, at(4, 0.2));
    expect(r2.runs).toBe(0);
    expect(r2.entries).toBe(0);
    expect(await w.store.openPositions()).toHaveLength(1);
    expect(kinds(w)).toEqual(["signal", "fill"]);
    const pos = (await w.store.openPositions())[0];
    expect(pos.entryPrice).toBe(11.1);
    expect(pos.entryCandleDate).toBe(utcDate(day(3)));
    expect(w.store.runs.get(`s1:${utcDate(day(3))}`)?.outcome).toBe("entered");

    // Next candle closes below the lookback low: exit on signal at the bid.
    w.candles = bars([10, 10, 10, 11, 9]);
    w.price = { ...w.price, bid: 9.2, mid: 9.3, ask: 9.4 };
    const r3 = await runTick(w.deps, at(5, 0.05));
    expect(r3.exits).toBe(1);
    const closed = Array.from(w.store.positions.values())[0];
    expect(closed.closeReason).toBe("signal");
    expect(closed.exitPrice).toBe(9.2);
    expect(closed.daysHeld).toBe(1);
    expect(closed.feesUsd).toBeCloseTo(0.2 + 1.0 + 0.06);
    expect(closed.realisedPnlUsd).toBeCloseTo((200 * (9.2 - 11.1)) / 11.1 - 1.26);
    expect(kinds(w)).toEqual(["signal", "fill", "signal", "close"]);
  });

  it("fires a take profit between checks at the observed bid", async () => {
    const w = world([strategy({ spec: { exit: { takeProfitPct: 5 } } })], [10, 10, 10, 11]);
    await runTick(w.deps, at(4, 0.05));
    w.price = { ...w.price, bid: 11.7, mid: 11.75, ask: 11.8 };
    const r = await runTick(w.deps, at(4, 13));
    expect(r.exits).toBe(1);
    expect(r.runs).toBe(0);
    const p = Array.from(w.store.positions.values())[0];
    expect(p.closeReason).toBe("take-profit");
    expect(p.exitPrice).toBe(11.7);
    expect(p.pricePnlUsd).toBeCloseTo((200 * 0.6) / 11.1);
    expect(p.realisedPnlUsd).toBeCloseTo((200 * 0.6) / 11.1 - 1.2);
    expect(w.store.activity.at(-1)?.reason).toBe("take-profit");
  });

  it("fires a stop loss and a liquidation", async () => {
    const sl = world([strategy({ spec: { exit: { stopLossPct: 10 } } })], [10, 10, 10, 11]);
    await runTick(sl.deps, at(4, 0.05));
    sl.price = { ...sl.price, bid: 9.0, mid: 9.1, ask: 9.2 };
    await runTick(sl.deps, at(4, 9));
    expect(Array.from(sl.store.positions.values())[0].closeReason).toBe("stop-loss");

    const liq = world([strategy()], [10, 10, 10, 11]);
    await runTick(liq.deps, at(4, 0.05));
    liq.price = { ...liq.price, bid: 5.4, mid: 5.5, ask: 5.6 };
    await runTick(liq.deps, at(4, 9));
    const p = Array.from(liq.store.positions.values())[0];
    expect(p.closeReason).toBe("liquidation");
    expect(p.pricePnlUsd).toBe(-100);
    expect(p.feesUsd).toBeCloseTo(0.7);
    expect(p.realisedPnlUsd).toBeCloseTo(-100.7);
    expect(await liq.store.availableCollateral("u1")).toBeCloseTo(10_000 - 100.7);
  });

  it("the daily loss stop refuses the entry decided on the losing day", async () => {
    const w = world([strategy({ spec: { exit: { stopLossPct: 10 }, caps: { maxPositionUsd: 1000, dailyLossLimitUsd: 10 } } })], [10, 10, 10, 11]);
    await runTick(w.deps, at(4, 0.05));
    w.price = { ...w.price, bid: 9.0, mid: 9.1, ask: 9.2 };
    await runTick(w.deps, at(4, 9)); // stop loss, about $39 lost on day 4
    w.candles = bars([10, 10, 10, 11, 12]); // day 4 closes above the lookback high
    w.price = { ...w.price, bid: 12.0, mid: 12.1, ask: 12.2 };
    const r = await runTick(w.deps, at(5, 0.05));
    expect(r.refusals).toBe(1);
    expect(r.entries).toBe(0);
    const refusal = w.store.activity.find((a) => a.kind === "refusal")!;
    expect((refusal.meta as { codes: string[] }).codes).toContain("daily-loss-stop");
    expect(w.store.runs.get(`s1:${utcDate(day(4))}`)?.outcome).toBe("refused");
    w.candles = bars([10, 10, 10, 11, 12, 13]);
    const r2 = await runTick(w.deps, at(6, 0.05));
    expect(r2.entries).toBe(1);
  });

  it("logs one skip for a closed market and runs that candle at the next open tick", async () => {
    const w = world([strategy()], [10, 10, 10, 11]);
    w.price = { ...w.price, isOpen: false };
    const r1 = await runTick(w.deps, at(4, 0.05));
    expect(r1.skips).toBe(1);
    expect(r1.runs).toBe(0);
    await runTick(w.deps, at(4, 0.5));
    expect(kinds(w)).toEqual(["skip"]);
    expect(w.store.runs.size).toBe(0);
    w.price = { ...w.price, isOpen: true };
    const r3 = await runTick(w.deps, at(4, 14.6));
    expect(r3.entries).toBe(1);
    expect((await w.store.openPositions())[0].entryCandleDate).toBe(utcDate(day(3)));
  });

  it("accrues rollover across a weekend of closed ticks", async () => {
    const w = world([strategy()], [10, 10, 10, 11]);
    await runTick(w.deps, at(4, 0.05));
    w.price = { ...w.price, isOpen: false };
    w.candles = bars([10, 10, 10, 11, 11, 11]);
    await runTick(w.deps, at(5, 0.05));
    await runTick(w.deps, at(6, 0.05));
    w.price = { ...w.price, isOpen: true };
    w.candles = bars([10, 10, 10, 11, 11, 11, 11]);
    await runTick(w.deps, at(7, 0.05));
    const p = (await w.store.openPositions())[0];
    expect(p.daysHeld).toBe(3);
    expect(p.rolloverUsd).toBeCloseTo(0.18);
    w.price = { ...w.price, bid: 11.7 };
    const before = p.rolloverUsd;
    await runTick(w.deps, at(7, 15));
    expect(Array.from(w.store.positions.values())[0].rolloverUsd).toBeCloseTo(before);
  });

  it("refuses an entry the paper balance cannot cover", async () => {
    const big = { size: { collateralUsd: 6_000, leverage: 1 }, caps: { maxPositionUsd: 10_000, dailyLossLimitUsd: 0 } };
    const w = world([strategy({ id: "a", spec: big }), strategy({ id: "b", spec: big })], [10, 10, 10, 11]);
    const r = await runTick(w.deps, at(4, 0.05));
    expect(r.entries).toBe(1);
    expect(r.refusals).toBe(1);
    const refusal = w.store.activity.find((a) => a.kind === "refusal")!;
    expect((refusal.meta as { codes: string[] }).codes).toEqual(["paper-balance"]);
    expect(await w.store.availableCollateral("u1")).toBe(4_000);
  });

  it("a stopped strategy's position closes at the first tick with a bid", async () => {
    const w = world([strategy()], [10, 10, 10, 11]);
    await runTick(w.deps, at(4, 0.05));
    w.store.strategies.set("s1", { ...w.store.strategies.get("s1")!, status: "draft" });
    w.price = { ...w.price, isOpen: false };
    await runTick(w.deps, at(4, 6));
    expect(await w.store.openPositions()).toHaveLength(1);
    w.price = { ...w.price, isOpen: true, bid: 11.2 };
    await runTick(w.deps, at(4, 7));
    expect(await w.store.openPositions()).toHaveLength(0);
    expect(Array.from(w.store.positions.values())[0].closeReason).toBe("stopped");
  });

  it("closeForStop closes at the bid or says why it cannot", async () => {
    const w = world([strategy()], [10, 10, 10, 11]);
    await runTick(w.deps, at(4, 0.05));
    w.price = { ...w.price, isOpen: false };
    expect((await closeForStop(w.deps, "s1", at(4, 1))).closed).toBe(false);
    w.price = { ...w.price, isOpen: true };
    const r = await closeForStop(w.deps, "s1", at(4, 2));
    expect(r.closed).toBe(true);
    expect(Array.from(w.store.positions.values())[0].closeReason).toBe("stopped");
  });

  it("a stale unfinished claim is run again; a fresh one is left alone", async () => {
    const w = world([strategy()], [10, 10, 10, 11]);
    const date = utcDate(day(3));
    expect(await w.store.claimRun("s1", date, at(4, 0.05))).toBe(true);
    const r1 = await runTick(w.deps, at(4, 0.1));
    expect(r1.runs).toBe(0);
    const r2 = await runTick(w.deps, at(4, 0.3));
    expect(r2.runs).toBe(1);
    expect(r2.entries).toBe(1);
  });
});
