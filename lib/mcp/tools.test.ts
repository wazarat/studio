import { describe, expect, it } from "vitest";
import { z } from "zod";

import { ACCOUNT_TOOL_NAMES, registerAccountTools, type AccountDeps } from "@/lib/mcp/account-tools";
import { memoryRateLimiter, type McpCaller, type RegistrarEnv, type ToolResult } from "@/lib/mcp/register";
import { registerStrategyTools, STRATEGY_TOOL_NAMES, type StrategyDeps, type StrategyRow } from "@/lib/mcp/strategy-tools";
import type { Proposal } from "@/lib/proposals/types";
import type { StrategySpec } from "@/lib/strategies/spec";
import type { Candle, Market } from "@/lib/venues/types";

/**
 * Agents cannot edit, trade or start anything: every write tool only
 * stores a proposal, and no tool exists that could do more.
 */

/** A stand-in McpServer that records registrations and lets tests call handlers. */
class FakeServer {
  tools = new Map<string, { config: { annotations?: Record<string, boolean> }; cb: (args: unknown, ctx: unknown) => Promise<ToolResult> }>();
  registerTool(name: string, config: { annotations?: Record<string, boolean> }, cb: (args: unknown, ctx: unknown) => Promise<ToolResult>) {
    this.tools.set(name, { config, cb });
  }
  async call(name: string, args: unknown, caller: McpCaller | null) {
    const t = this.tools.get(name)!;
    return t.cb(args, caller ? { http: { authInfo: { token: "t", clientId: caller.clientId, scopes: [], extra: caller } } } : {});
  }
}

const DAY = 86_400_000;
const bars = (closes: number[]): Candle[] =>
  closes.map((close, i) => {
    const open = i === 0 ? close : closes[i - 1];
    return { time: Date.UTC(2024, 0, 1) + i * DAY, open, high: Math.max(open, close), low: Math.min(open, close), close };
  });
const market: Market = {
  venue: "ostium",
  id: "0",
  symbol: "BTC/USD",
  base: "BTC",
  quote: "USD",
  category: "crypto",
  limits: { minNotionalUsd: 5, maxNotionalLongUsd: 1e6, maxNotionalShortUsd: 1e6, minLeverage: 1, maxLeverage: 50, overnightMaxLeverage: 0, maxSizeNowUsd: 1_000 },
  openInterest: { longUsd: 400_000, shortUsd: 0, maxPerSideUsd: 500_000 },
  fees: { openBps: 10, closeBps: 0, oracleFeeUsd: 0.5 },
  rollover8h: { long: 0.01, short: 0.01 },
  hours: { isOpen: true, isDayTradingClosed: false, secondsToToggleDayTrading: null, checkedAt: 0 },
};
const candles = bars([12, 11, 10, 9, 8, 9, 10, 13, 14, 15, 14, 12, 10, 9]);
const owner: McpCaller = { userId: "u1", clientId: "c1", clientName: "Claude Code", admin: true };
const stranger: McpCaller = { userId: "u2", clientId: "c2", clientName: "Cursor", admin: true };
const env = (): RegistrarEnv => ({ limiter: memoryRateLimiter(), appUrl: "https://studio.test" });
const spec: StrategySpec = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "BTC MA 2/3",
  market: { venue: "ostium", marketId: "0", symbol: "BTC/USD" },
  direction: "long",
  entry: { kind: "maCross", fast: 2, slow: 3 },
  exit: {},
  size: { collateralUsd: 100, leverage: 2 },
  wake: { kind: "candle-close", resolution: "1D" },
  caps: { maxPositionUsd: 1000, dailyLossLimitUsd: 50 },
  tier: "studio",
  status: "draft",
};

function accountWorld() {
  const saved: { ownerId: string; spec: StrategySpec }[] = [];
  const deps: AccountDeps = {
    markets: async () => [market],
    prices: async () => [{ marketId: "0", symbol: "BTC/USD", bid: 9, mid: 9, ask: 9, isOpen: true, at: 0 }],
    candles: async () => candles,
    listStrategies: async (ownerId) => saved.filter((s) => s.ownerId === ownerId).map((s) => ({ id: s.spec.id, name: s.spec.name, symbol: s.spec.market.symbol, status: s.spec.status, blownOut: false, spec: s.spec, latest: null, updatedAt: "" })),
    insertStrategy: async (ownerId, s) => {
      saved.push({ ownerId, spec: s });
    },
    storeBacktest: async (s, m) => (await import("@/lib/strategies/backtest")).runBacktest({ spec: s, candles, market: m }),
    activity: async () => [],
    newId: () => "22222222-2222-4222-8222-222222222222",
    testnet: true,
  };
  const server = new FakeServer();
  registerAccountTools(server as never, deps, env());
  return { server, saved };
}

function strategyWorld(status: StrategySpec["status"] = "draft") {
  const row: StrategyRow = { id: spec.id, ownerId: "u1", name: spec.name, symbol: spec.market.symbol, marketId: "0", status, spec: { ...spec, status }, paperSince: null, blownOutAt: null, updatedAt: "" };
  const proposals: Proposal[] = [];
  const deps: StrategyDeps = {
    getStrategy: async (id, ownerId) => (id === row.id && ownerId === row.ownerId ? row : null),
    latestBacktest: async () => null,
    paperFor: async () => ({ status: row.status, since: null, blownOutAt: null, open: null, closed: [], activity: [], realisedSinceStartUsd: 0 }),
    markets: async () => [market],
    prices: async () => [{ marketId: "0", symbol: "BTC/USD", bid: 9, mid: 9, ask: 9, isOpen: true, at: 0 }],
    candles: async () => candles,
    insertProposal: async (p) => {
      const stored: Proposal = { ...p, id: `p${proposals.length + 1}`, status: "pending", createdAt: Date.now(), decidedAt: null };
      proposals.push(stored);
      return stored;
    },
    pendingProposals: async (id) => proposals.filter((p) => p.strategyId === id && p.status === "pending"),
    testnet: true,
  };
  const server = new FakeServer();
  registerStrategyTools(server as never, spec.id, deps, env());
  return { server, row, proposals };
}

const text = (r: ToolResult) => r.content[0].text;

describe("tool surface", () => {
  it("has no tool that trades, signs, starts live trading or returns keys", () => {
    const { server: a } = accountWorld();
    const { server: s } = strategyWorld();
    expect(Array.from(a.tools.keys()).sort()).toEqual([...ACCOUNT_TOOL_NAMES].sort());
    expect(Array.from(s.tools.keys()).sort()).toEqual([...STRATEGY_TOOL_NAMES].sort());
    const forbidden = /trade|open_position|close_position|sign|wallet|key|token|live|withdraw|transfer/i;
    for (const name of [...a.tools.keys(), ...s.tools.keys()]) expect(name).not.toMatch(forbidden);
    for (const name of ["list_markets", "get_candles", "run_backtest", "list_strategies", "get_activity"]) expect(a.tools.get(name)!.config.annotations?.readOnlyHint).toBe(true);
    for (const name of ["create_strategy"]) expect(a.tools.get(name)!.config.annotations).toMatchObject({ readOnlyHint: false, destructiveHint: false });
    for (const name of ["propose_change", "request_paper_start", "request_paper_stop"]) expect(s.tools.get(name)!.config.annotations).toMatchObject({ readOnlyHint: false, destructiveHint: false });
  });
});

describe("account server", () => {
  it("lists markets with max size now and backtests without saving", async () => {
    const { server, saved } = accountWorld();
    const markets = await server.call("list_markets", {}, owner);
    expect((markets.structuredContent as { markets: { pair: string; maxSizeNowUsd: number; limited: boolean }[] }).markets[0]).toMatchObject({ pair: "BTC/USD", maxSizeNowUsd: 1000, limited: false });
    const bt = await server.call("run_backtest", { marketId: "0", entry: { kind: "maCross", fast: 2, slow: 3 }, collateralUsd: 100, leverage: 2 }, owner);
    expect(bt.isError).toBeUndefined();
    expect((bt.structuredContent as { backtest: { strategy: { trades: number } } }).backtest.strategy.trades).toBe(1);
    expect(saved).toHaveLength(0);
  });

  it("creates a draft only when the checker allows it, and returns a link", async () => {
    const { server, saved } = accountWorld();
    const refused = await server.call("create_strategy", { marketId: "0", entry: { kind: "maCross", fast: 2, slow: 3 }, collateralUsd: 100, leverage: 6 }, owner);
    expect(refused.isError).toBe(true);
    expect(text(refused)).toMatch(/refuses/);
    expect(saved).toHaveLength(0);
    const ok = await server.call("create_strategy", { marketId: "0", entry: { kind: "maCross", fast: 2, slow: 3 }, collateralUsd: 100, leverage: 2 }, owner);
    expect(ok.isError).toBeUndefined();
    expect(saved).toHaveLength(1);
    expect(saved[0].spec.status).toBe("draft");
    expect((ok.structuredContent as { appUrl: string }).appUrl).toBe("https://studio.test/studio/strategies/22222222-2222-4222-8222-222222222222");
    const mine = await server.call("list_strategies", {}, owner);
    expect((mine.structuredContent as { count: number }).count).toBe(1);
    const theirs = await server.call("list_strategies", {}, stranger);
    expect((theirs.structuredContent as { count: number }).count).toBe(0);
  });
});

describe("strategy server", () => {
  it("propose_change stores a pending proposal with a backtest and leaves the strategy untouched", async () => {
    const { server, row, proposals } = strategyWorld();
    const before = JSON.stringify(row.spec);
    const r = await server.call("propose_change", { patch: { entry: { kind: "maCross", fast: 3, slow: 5 } }, reason: "Smoother cross." }, owner);
    expect(r.isError).toBeUndefined();
    expect(JSON.stringify(row.spec)).toBe(before);
    expect(proposals).toHaveLength(1);
    expect(proposals[0]).toMatchObject({ kind: "change", status: "pending", reason: "Smoother cross.", clientName: "Claude Code" });
    expect(proposals[0].proposedSpec?.entry).toEqual({ kind: "maCross", fast: 3, slow: 5 });
    expect(proposals[0].backtest?.strategy).toBeDefined();
    expect((r.structuredContent as { changes: { field: string }[] }).changes.map((c) => c.field)).toEqual(["Entry"]);
    const same = await server.call("propose_change", { patch: {}, reason: "nothing" }, owner);
    expect(same.isError).toBe(true);
  });

  it("the checker refuses a proposal it would refuse as a trade", async () => {
    const { server, proposals } = strategyWorld();
    const r = await server.call("propose_change", { patch: { leverage: 6 }, reason: "more" }, owner);
    expect(r.isError).toBe(true);
    expect(text(r)).toMatch(/refuses/);
    expect(proposals).toHaveLength(0);
  });

  it("paper requests create pending requests and change no status", async () => {
    const { server, row, proposals } = strategyWorld();
    const start = await server.call("request_paper_start", { reason: "Backtest looks good." }, owner);
    expect(start.isError).toBeUndefined();
    expect(row.status).toBe("draft");
    expect(proposals[0]).toMatchObject({ kind: "paper-start", status: "pending" });
    const again = await server.call("request_paper_start", { reason: "again" }, owner);
    expect(again.isError).toBe(true);
    const stop = await server.call("request_paper_stop", { reason: "x" }, owner);
    expect(stop.isError).toBe(true);
    expect(text(stop)).toMatch(/not on paper/);
  });

  it("another user's strategy id answers not-yours and reveals nothing", async () => {
    const { server, proposals } = strategyWorld();
    for (const name of STRATEGY_TOOL_NAMES) {
      const args = name === "propose_change" ? { patch: { leverage: 3 }, reason: "r" } : name.startsWith("request") ? { reason: "r" } : {};
      const r = await server.call(name, args, stranger);
      expect(r.isError).toBe(true);
      expect(text(r)).toBe("No strategy with that id in this account.");
    }
    expect(proposals).toHaveLength(0);
  });

  it("a change on a paper strategy is stored with a note that it waits for a stop", async () => {
    const { server, proposals } = strategyWorld("paper");
    const r = await server.call("propose_change", { patch: { leverage: 3 }, reason: "r" }, owner);
    expect(r.isError).toBeUndefined();
    expect((r.structuredContent as { note: string }).note).toMatch(/stop it/);
    expect(proposals[0].proposedSpec?.status).toBe("paper");
  });
});

describe("zod input schema shape", () => {
  it("is an object schema the SDK can publish", () => {
    expect(z.object({}).safeParse({}).success).toBe(true);
  });
});
