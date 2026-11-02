import { describe, expect, it } from "vitest";

import { liveDeps, type LiveControls, type SessionDeps } from "@/lib/live/executor";
import { MemoryLiveStore } from "@/lib/live/store-memory";
import type { WalletSession } from "@/lib/live/store";
import { DAY_MS, utcDate } from "@/lib/paper/engine";
import { runTick } from "@/lib/paper/runner";
import { MemoryPaperStore } from "@/lib/paper/store-memory";
import type { LiveDeps, PaperStrategy, TickDeps } from "@/lib/paper/store";
import type { DelegationStatus, FillRow } from "@/lib/venues/ostium";
import type { Candle, Market, OpenIntent, Position, Price, UnsignedTx } from "@/lib/venues/types";

/**
 * Live execution against in-memory stores and a fake venue: the checker
 * runs before every submission, retries never send twice, pause blocks
 * entries but not closes, and a revoked or expired permission stops the
 * strategy with one row in the feed and nothing more sent.
 */
const day = (k: number) => Date.UTC(2026, 9, 1) + k * DAY_MS;
const at = (k: number, hours: number) => day(k) + hours * 3_600_000;
const bars = (closes: number[]): Candle[] =>
  closes.map((close, i) => {
    const open = i === 0 ? close : closes[i - 1];
    return { time: day(i), open, high: Math.max(open, close), low: Math.min(open, close), close };
  });
const TRADER = "0x1111111111111111111111111111111111111111" as const;
const SESSION = "0x2222222222222222222222222222222222222222" as const;

function market(over: Partial<Market> = {}): Market {
  return {
    venue: "ostium",
    id: "0",
    symbol: "BTC/USD",
    base: "BTC",
    quote: "USD",
    category: "crypto",
    limits: { minNotionalUsd: 5, maxNotionalLongUsd: 1e6, maxNotionalShortUsd: 1e6, minLeverage: 1, maxLeverage: 50, overnightMaxLeverage: 0, maxSizeNowUsd: 5_000 },
    openInterest: { longUsd: 0, shortUsd: 0, maxPerSideUsd: 5_000_000 },
    fees: { openBps: 10, closeBps: 0, oracleFeeUsd: 0.5 },
    rollover8h: { long: 0.01, short: 0.01 },
    hours: { isOpen: true, isDayTradingClosed: false, secondsToToggleDayTrading: null, checkedAt: 0 },
    ...over,
  };
}

function strategy(over: Omit<Partial<PaperStrategy>, "spec"> & { spec?: Partial<PaperStrategy["spec"]> } = {}): PaperStrategy {
  const { spec, ...rest } = over;
  const id = over.id ?? "s1";
  return {
    id,
    ownerId: "u1",
    name: `Live ${id}`,
    symbol: "BTC/USD",
    marketId: "0",
    status: "live",
    paperSince: at(3, 12),
    ...rest,
    spec: {
      id,
      name: `Live ${id}`,
      market: { venue: "ostium", marketId: "0", symbol: "BTC/USD" },
      direction: "long",
      entry: { kind: "breakout", lookback: 2 },
      exit: { takeProfitPct: 5, stopLossPct: 10 },
      size: { collateralUsd: 100, leverage: 2 },
      wake: { kind: "candle-close", resolution: "1D" },
      caps: { maxPositionUsd: 1000, dailyLossLimitUsd: 0 },
      tier: "studio",
      status: "live",
      ...spec,
    },
  };
}

interface Fake extends SessionDeps {
  opens: OpenIntent[];
  closes: Array<{ marketId: string; index: number }>;
  sent: UnsignedTx[];
  chain: Position[];
  fills: FillRow[];
  status: DelegationStatus;
  destroyed: number;
  sendError: Error | null;
}

function fakeSession(): Fake {
  let n = 0;
  const f: Fake = {
    opens: [],
    closes: [],
    sent: [],
    chain: [],
    fills: [],
    status: { ready: true, allowanceUsd: 500, usdcUsd: 1_000, ethBalance: 1, currentDelegate: SESSION, delegateMatches: true },
    destroyed: 0,
    sendError: null,
    venue: {
      async buildOpen(_t, intent) {
        f.opens.push(intent);
        return { chainId: 421614, to: "0xaa", data: `0x0${f.opens.length}`, value: "0", from: SESSION };
      },
      async buildClose(_t, intent) {
        f.closes.push({ marketId: intent.marketId, index: intent.index });
        return { chainId: 421614, to: "0xaa", data: `0xc${f.closes.length}`, value: "0", from: SESSION };
      },
      async buildUpdate() {
        return [];
      },
    },
    signer: {
      address: SESSION,
      async send(tx) {
        if (f.sendError) throw f.sendError;
        f.sent.push(tx);
        return { hash: `0xhash${++n}` as `0x${string}` };
      },
    },
    positions: async () => f.chain.map((p) => ({ ...p })),
    fillsSince: async (fromMs) => f.fills.filter((x) => x.at >= fromMs - 1),
    delegation: async () => ({ ...f.status }),
    orderId: async (hash) => `oid-${hash}`,
    orderStatus: async () => [],
    destroyKey: async () => {
      f.destroyed++;
    },
  };
  return f;
}

const position = (pid: string, over: Partial<Position> = {}): Position => ({
  marketId: "0",
  symbol: "BTC/USD",
  index: 0,
  side: "long",
  sizeUsd: 200,
  collateralUsd: 100,
  leverage: 2,
  entryPrice: 11.1,
  liquidationPrice: 6,
  unrealizedPnlUsd: 0,
  takeProfit: 11.65,
  stopLoss: 10,
  openedAt: at(4, 0.06),
  isDayTrade: false,
  pid,
  ...over,
});

const fill = (over: Partial<FillRow>): FillRow => ({
  marketId: "0",
  symbol: "BTC/USD",
  action: "Open",
  type: "Market",
  side: "long",
  price: 11.12,
  sizeUsd: 200,
  collateralUsd: 100,
  leverage: 2,
  closedPnlUsd: 0,
  fees: { opening: 0.2, rollover: 0, builder: 0, oracle: 0.5, priceImpact: 0 },
  hash: "0xkeeper",
  at: at(4, 0.07),
  ...over,
});

interface World {
  paper: MemoryPaperStore;
  live: MemoryLiveStore;
  fake: Fake;
  session: WalletSession;
  price: Price;
  candles: Candle[];
  deps: TickDeps;
  executor: LiveDeps & LiveControls;
}

async function world(strategies: PaperStrategy[], closes: number[], m: Market = market(), expiresAt: number | null = null): Promise<World> {
  const paper = new MemoryPaperStore(strategies);
  const live = new MemoryLiveStore(strategies);
  const fake = fakeSession();
  const session = await live.createSession({ ownerId: "u1", trader: TRADER, sessionAddress: SESSION, kmsKeyId: "key-1", expiresAt }, at(3, 11));
  await live.setSessionStatus(session.id, "active", ["pending"], at(3, 11));
  for (const s of strategies) await live.upsertLink({ strategyId: s.id, sessionId: session.id, ownerId: "u1", totalCapUsd: 500 }, at(3, 11));
  const executor = liveDeps({ live, paper, sessionDepsFor: () => fake, testnet: true, sleep: async () => undefined });
  const w: World = {
    paper,
    live,
    fake,
    session,
    executor,
    price: { marketId: "0", symbol: "BTC/USD", bid: 10.9, mid: 11, ask: 11.1, isOpen: true, at: 0 },
    candles: bars(closes),
    deps: {
      store: paper,
      prices: { prices: async () => [w.price] },
      markets: async () => [m],
      candles: async (_id, nowMs) => w.candles.filter((c) => c.time < Math.floor(nowMs / DAY_MS) * DAY_MS),
      testnet: true,
      live: executor,
    },
  };
  return w;
}

const kinds = (w: World) => w.paper.activity.map((a) => `${a.mode}:${a.kind}`);

/** Lets the keeper fill the strategy's submitted open and puts the position on-chain. */
async function fillOpen(w: World, strategyId: string, pid: string, atMs = at(4, 0.07)) {
  const o = (await w.live.pendingOrders(strategyId)).find((x) => x.kind === "open")!;
  w.fake.fills.push(fill({ oid: `oid-${o.txHash}`, pid, hash: o.txHash!, at: atMs }));
  w.fake.chain.push(position(pid, { index: w.fake.chain.length }));
}

describe("live executor", () => {
  it("refuses an out-of-cap trade before anything is built or signed", async () => {
    const w = await world([strategy({ spec: { size: { collateralUsd: 100, leverage: 10 } } })], [10, 10, 10, 11]);
    const r = await runTick(w.deps, at(4, 0.05));
    expect(r.refusals).toBe(1);
    expect(w.fake.opens).toHaveLength(0);
    expect(w.fake.sent).toHaveLength(0);
    expect(w.live.orders).toHaveLength(0);
    const refusal = w.paper.activity.find((a) => a.kind === "refusal")!;
    expect(refusal.mode).toBe("live");
    expect((refusal.meta as { codes: string[] }).codes).toContain("leverage-over-tier");
  });

  it("sends one open with take profit and stop loss on the trade, and never a second for the same candle", async () => {
    const w = await world([strategy()], [10, 10, 10, 11]);
    const r1 = await runTick(w.deps, at(4, 0.05));
    expect(r1.entries).toBe(1);
    expect(w.fake.sent).toHaveLength(1);
    expect(w.fake.opens[0].takeProfit).toBeCloseTo(11.1 * 1.05);
    expect(w.fake.opens[0].stopLoss).toBeCloseTo(11.1 * 0.9);
    const o = w.live.orders[0];
    expect(o.status).toBe("submitted");
    expect(o.txHash).toBe("0xhash1");
    expect(o.oid).toBe("oid-0xhash1");
    expect((await w.live.link("s1"))!.spentUsd).toBe(100);
    expect(kinds(w)).toEqual(["live:signal", "live:fill"]);

    const r2 = await runTick(w.deps, at(4, 0.2));
    expect(r2.entries).toBe(0);
    expect(w.fake.sent).toHaveLength(1);
    expect(w.live.orders).toHaveLength(1);

    // The keeper fills it: the order carries the position id and the feed shows the real price.
    await fillOpen(w, "s1", "pid-1");
    const r3 = await runTick(w.deps, at(4, 0.4));
    expect(r3.entries).toBe(0);
    expect(w.live.orders[0].status).toBe("filled");
    expect(w.live.orders[0].pid).toBe("pid-1");
    expect(w.paper.activity.at(-1)).toMatchObject({ kind: "fill", reason: "filled", price: 11.12 });
    expect(await w.deps.live!.openPositions((await w.deps.live!.strategies())[0])).toMatchObject([{ id: "live:pid-1", takeProfit: undefined, stopLoss: undefined, liquidationPrice: 0 }]);
  });

  it("a take profit that fired on-chain is read back as a close with the fill's PnL, and feeds the daily stop", async () => {
    const w = await world([strategy({ spec: { caps: { maxPositionUsd: 1000, dailyLossLimitUsd: 10 } } })], [10, 10, 10, 11]);
    await runTick(w.deps, at(4, 0.05));
    await fillOpen(w, "s1", "pid-1");
    await runTick(w.deps, at(4, 0.4));
    // The chain closed it at a loss (a stop loss here) and the position is gone.
    w.fake.chain = [];
    w.fake.fills.push(fill({ action: "StopLoss", pid: "pid-1", price: 9.99, closedPnlUsd: -20, hash: "0xsl", at: at(4, 9) }));
    const r = await runTick(w.deps, at(4, 9.1));
    expect(r.exits).toBe(0);
    expect(w.fake.closes).toHaveLength(0);
    const open = w.live.orders[0];
    expect(open.closeReason).toBe("stop-loss");
    expect(open.closePnlUsd).toBe(-20);
    expect(w.paper.activity.at(-1)).toMatchObject({ kind: "close", reason: "stop-loss", pnlUsd: -20 });
    expect(await w.deps.live!.lossForDay((await w.deps.live!.strategies())[0], utcDate(day(4)))).toBe(20);
    // The next entry decided that day is refused by the daily stop, before any build.
    w.candles = bars([10, 10, 10, 11, 12]);
    w.price = { ...w.price, bid: 12, mid: 12.1, ask: 12.2 };
    const r2 = await runTick(w.deps, at(5, 0.05));
    expect(r2.refusals).toBe(1);
    expect(w.fake.sent).toHaveLength(1);
  });

  it("closes on the exit signal through the delegate and nothing else", async () => {
    const w = await world([strategy()], [10, 10, 10, 11]);
    await runTick(w.deps, at(4, 0.05));
    await fillOpen(w, "s1", "pid-1");
    await runTick(w.deps, at(4, 0.4));
    // A bid through the stop loss between checks does nothing: the chain handles it.
    w.price = { ...w.price, bid: 9.0, mid: 9.1, ask: 9.2 };
    const r0 = await runTick(w.deps, at(4, 9));
    expect(r0.exits).toBe(0);
    expect(w.fake.closes).toHaveLength(0);
    // The next candle closes below the lookback low: exit on signal.
    w.candles = bars([10, 10, 10, 11, 9]);
    w.price = { ...w.price, bid: 9.2, mid: 9.3, ask: 9.4 };
    const r = await runTick(w.deps, at(5, 0.05));
    expect(r.exits).toBe(1);
    expect(w.fake.closes).toEqual([{ marketId: "0", index: 0 }]);
    const close = w.live.orders.find((o) => o.kind === "close")!;
    expect(close.status).toBe("submitted");
    expect(close.ref).toBe("pid-1");
    // A retry does not send a second close.
    await runTick(w.deps, at(5, 0.2));
    expect(w.fake.closes).toHaveLength(1);
    // The keeper fills the close: the open order is marked closed with the realised PnL.
    w.fake.chain = [];
    w.fake.fills.push(fill({ action: "Close", oid: `oid-${close.txHash}`, pid: "pid-1", price: 9.21, closedPnlUsd: -34.5, hash: "0xc", at: at(5, 0.3) }));
    await runTick(w.deps, at(5, 0.4));
    expect(w.live.orders[0]).toMatchObject({ closeReason: "signal", closePnlUsd: -34.5 });
    expect(w.paper.activity.at(-1)).toMatchObject({ kind: "close", reason: "signal", pnlUsd: -34.5 });
  });

  it("pause blocks entries without claiming the candle; close all still works while paused", async () => {
    const w = await world([strategy()], [10, 10, 10, 11]);
    await runTick(w.deps, at(4, 0.05));
    await fillOpen(w, "s1", "pid-1");
    await runTick(w.deps, at(4, 0.4));
    await w.live.setLinkStatus("s1", "paused", ["active"], at(4, 1));
    w.candles = bars([10, 10, 10, 11, 9, 12]);
    w.price = { ...w.price, bid: 12, mid: 12.1, ask: 12.2 };
    w.fake.chain = [];
    w.fake.fills.push(fill({ action: "TakeProfit", pid: "pid-1", price: 11.7, closedPnlUsd: 10, hash: "0xtp", at: at(5, 1) }));
    const r = await runTick(w.deps, at(6, 0.05));
    expect(r.entries).toBe(0);
    expect(r.skips).toBe(1);
    expect(w.paper.activity.at(-1)?.reason).toMatch(/paused/);
    expect(w.paper.runs.has(`s1:${utcDate(day(5))}`)).toBe(false);
    // Resume later the same day: the candle is still acted on.
    await w.live.setLinkStatus("s1", "active", ["paused"], at(6, 2));
    const r2 = await runTick(w.deps, at(6, 2.1));
    expect(r2.entries).toBe(1);
    await fillOpen(w, "s1", "pid-2", at(6, 2.2));
    await runTick(w.deps, at(6, 2.5));
    // Pause again, then Close all: the close goes out while paused.
    await w.live.setLinkStatus("s1", "paused", ["active"], at(6, 3));
    const result = await w.executor.closeAll("s1", at(6, 3.1));
    expect(result).toEqual({ submitted: 1, skipped: [] });
    expect(w.fake.closes).toEqual([{ marketId: "0", index: 0 }]);
  });

  it("stop closes at the bid, then ends the strategy and destroys the wallet's key once flat", async () => {
    const w = await world([strategy()], [10, 10, 10, 11]);
    await runTick(w.deps, at(4, 0.05));
    await fillOpen(w, "s1", "pid-1");
    await runTick(w.deps, at(4, 0.4));
    await w.live.setLinkStatus("s1", "closing", ["active", "paused"], at(4, 1));
    const r = await runTick(w.deps, at(4, 1.1));
    expect(r.exits).toBe(1);
    expect(r.runs).toBe(0);
    const close = w.live.orders.find((o) => o.kind === "close")!;
    expect(w.fake.destroyed).toBe(0);
    w.fake.chain = [];
    w.fake.fills.push(fill({ action: "Close", oid: `oid-${close.txHash}`, pid: "pid-1", price: 10.9, closedPnlUsd: -4, hash: "0xc", at: at(4, 1.2) }));
    await runTick(w.deps, at(4, 1.3));
    expect((await w.live.link("s1"))!.status).toBe("ended");
    expect(w.live.strategies.get("s1")!.status).toBe("draft");
    expect((await w.live.session(w.session.id))!.status).toBe("ended");
    expect(w.fake.destroyed).toBe(1);
    expect(await w.deps.live!.strategies()).toHaveLength(0);
  });

  it("a revoked delegate ends the permission with one row and nothing more is sent", async () => {
    const w = await world([strategy()], [10, 10, 10, 11]);
    w.fake.sendError = new Error('execution reverted: NotDelegate("0x1111", "0x2222")');
    const r = await runTick(w.deps, at(4, 0.05));
    expect(r.entries).toBe(0);
    expect((await w.live.link("s1"))!.status).toBe("permission-ended");
    expect((await w.live.session(w.session.id))!.status).toBe("permission-ended");
    expect(w.paper.activity.filter((a) => (a.meta as { codes?: string[] })?.codes?.includes("permission-ended"))).toHaveLength(1);
    expect(w.live.strategies.get("s1")!.status).toBe("live");
    expect(w.fake.destroyed).toBe(0);
    w.fake.sendError = null;
    w.candles = bars([10, 10, 10, 11, 12]);
    const r2 = await runTick(w.deps, at(5, 0.05));
    expect(r2.runs).toBe(0);
    expect(w.fake.sent).toHaveLength(0);
    expect(w.paper.activity.filter((a) => (a.meta as { codes?: string[] })?.codes?.includes("permission-ended"))).toHaveLength(1);
  });

  it("the on-chain delegate check and the expiry both end the permission before any build", async () => {
    const revoked = await world([strategy()], [10, 10, 10, 11]);
    revoked.fake.status = { ...revoked.fake.status, currentDelegate: "0x3333333333333333333333333333333333333333", delegateMatches: false };
    const r = await runTick(revoked.deps, at(4, 0.05));
    expect(r.skips).toBe(1);
    expect(revoked.fake.opens).toHaveLength(0);
    expect((await revoked.live.link("s1"))!.status).toBe("permission-ended");

    const expired = await world([strategy()], [10, 10, 10, 11], market(), at(3, 20));
    const r2 = await runTick(expired.deps, at(4, 0.05));
    expect(r2.skips).toBe(1);
    expect(expired.fake.opens).toHaveLength(0);
    expect((await expired.live.link("s1"))!.status).toBe("permission-ended");
    expect(expired.paper.activity.at(-2)?.reason).toMatch(/expiry/);
  });

  it("an approval too small for the collateral skips the entry with a top-up note", async () => {
    const w = await world([strategy()], [10, 10, 10, 11]);
    w.fake.status = { ...w.fake.status, allowanceUsd: 40 };
    const r = await runTick(w.deps, at(4, 0.05));
    expect(r.skips).toBe(1);
    expect(w.fake.opens).toHaveLength(0);
    expect(w.paper.activity.at(-1)?.reason).toMatch(/approval too low/);
  });

  it("two strategies on one wallet: each closes only its own position, and the wallet's exposure counts in the OI share", async () => {
    const w = await world([strategy({ id: "s1" }), strategy({ id: "s2" })], [10, 10, 10, 11]);
    await runTick(w.deps, at(4, 0.05));
    expect(w.fake.sent).toHaveLength(2);
    await fillOpen(w, "s1", "pid-1");
    await fillOpen(w, "s2", "pid-2");
    await runTick(w.deps, at(4, 0.4));
    await w.live.setLinkStatus("s1", "closing", ["active"], at(4, 1));
    const r = await runTick(w.deps, at(4, 1.1));
    expect(r.exits).toBe(1);
    const closes = w.live.orders.filter((o) => o.kind === "close");
    expect(closes.map((o) => [o.strategyId, o.ref])).toEqual([["s1", "pid-1"]]);
    expect(w.fake.closes).toEqual([{ marketId: "0", index: 0 }]);

    // A third strategy on a thin market: the wallet already has $400 open there, so $200 more is over 1% of the room.
    const thin = await world([strategy({ id: "s3" })], [10, 10, 10, 11], market({ openInterest: { longUsd: 4_950_000, shortUsd: 0, maxPerSideUsd: 5_000_000 } }));
    thin.fake.chain.push(position("other-1", { sizeUsd: 400 }));
    const r2 = await runTick(thin.deps, at(4, 0.05));
    expect(r2.refusals).toBe(1);
    expect(thin.fake.sent).toHaveLength(0);
    expect(thin.live.orders[0].status).toBe("failed");
    expect(thin.live.orders[0].error).toContain("size-over-oi-share");
  });

  it("a paper-only tick with no live dependency is unchanged", async () => {
    const paper = new MemoryPaperStore([{ ...strategy(), status: "paper", spec: { ...strategy().spec, status: "paper" } }]);
    const deps: TickDeps = {
      store: paper,
      prices: { prices: async () => [{ marketId: "0", symbol: "BTC/USD", bid: 10.9, mid: 11, ask: 11.1, isOpen: true, at: 0 }] },
      markets: async () => [market()],
      candles: async () => bars([10, 10, 10, 11]),
      testnet: true,
    };
    const r = await runTick(deps, at(4, 0.05));
    expect(r.entries).toBe(1);
    expect(paper.activity.map((a) => a.mode)).toEqual(["paper", "paper"]);
  });
});
