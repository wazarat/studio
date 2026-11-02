import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";

import { registerTool, type McpCaller, type RegistrarEnv } from "@/lib/mcp/register";
import { SpecInputSchema, specFromInput } from "@/lib/mcp/spec-input";
import { backtestView, marketView } from "@/lib/mcp/views";
import type { PriceComparison } from "@/lib/chainlink/compare";
import { checkRisk, type RiskLimits } from "@/lib/risk/check";
import type { ActivityEvent } from "@/lib/strategies/activity";
import { runBacktest, type BacktestResult } from "@/lib/strategies/backtest";
import type { StrategySpec } from "@/lib/strategies/spec";
import type { Candle, Market, Price } from "@/lib/venues/types";

/**
 * The account server's tools (step 6): read markets and history, backtest
 * an idea, save a draft, list strategies and the feed. Nothing here
 * trades, starts anything or edits a saved strategy. The dependencies are
 * an interface so the tests run with fakes.
 */
export interface StrategySummary {
  id: string;
  name: string;
  symbol: string;
  status: string;
  blownOut: boolean;
  spec: StrategySpec;
  latest: BacktestResult["strategy"] | null;
  updatedAt: string;
}

export interface AccountDeps {
  markets(): Promise<Market[]>;
  prices(ids?: string[]): Promise<Price[]>;
  candles(marketId: string): Promise<Candle[]>;
  listStrategies(ownerId: string): Promise<StrategySummary[]>;
  insertStrategy(ownerId: string, spec: StrategySpec): Promise<void>;
  storeBacktest(spec: StrategySpec, market: Market): Promise<BacktestResult>;
  activity(ownerId: string, limit: number): Promise<ActivityEvent[]>;
  reference?(symbol: string, mid: number): Promise<PriceComparison | null>;
  lossTodayUsd?(strategyId: string): Promise<number>;
  newId(): string;
  testnet: boolean;
  riskLimits?: Partial<RiskLimits>;
}

export const ACCOUNT_TOOL_NAMES = ["list_markets", "get_candles", "run_backtest", "create_strategy", "list_strategies", "get_activity"] as const;

export function registerAccountTools(server: McpServer, deps: AccountDeps, env: RegistrarEnv): void {
  const link = (path: string) => `${env.appUrl}${path}`;

  registerTool(
    server,
    {
      name: "list_markets",
      title: "List markets",
      description: "Every market on Ostium with its simple name, pair, class, whether it is open, max leverage, fees and the most one trade may open right now (1% of the remaining open interest). Markets under $50 of room are limited.",
      input: z.object({ class: z.enum(["crypto", "stocks", "indices", "forex", "commodities", "etf"]).optional().describe("Filter by class.") }),
      kind: "read",
    },
    async ({ class: cls }) => {
      const [markets, prices] = await Promise.all([deps.markets(), deps.prices().catch(() => [] as Price[])]);
      const byId = new Map(prices.map((p) => [p.marketId, p]));
      const rows = markets.filter((m) => !cls || m.category === cls).map((m) => marketView(m, byId));
      return { count: rows.length, markets: rows, appUrl: link("/studio") };
    },
    env,
  );

  registerTool(
    server,
    {
      name: "get_candles",
      title: "Get daily candles",
      description: "Completed daily candles for one market, oldest first, up to 1,100 rows. Times are UTC day starts in ms. Ostium's history starts on 1 Jan 2024 for crypto and at listing for newer markets.",
      input: z.object({
        marketId: z.string().min(1),
        from: z.string().optional().describe("YYYY-MM-DD, inclusive."),
        to: z.string().optional().describe("YYYY-MM-DD, inclusive."),
      }),
      kind: "read",
    },
    async ({ marketId, from, to }) => {
      const market = (await deps.markets()).find((m) => m.id === marketId);
      if (!market) throw new Error(`Unknown market ${marketId}. Use list_markets.`);
      const fromMs = from ? Date.parse(`${from}T00:00:00Z`) : -Infinity;
      const toMs = to ? Date.parse(`${to}T00:00:00Z`) : Infinity;
      const all = await deps.candles(marketId);
      const rows = all.filter((c) => c.time >= fromMs && c.time <= toMs).slice(-1100);
      return { market: market.symbol, historyStart: all[0] ? new Date(all[0].time).toISOString().slice(0, 10) : null, count: rows.length, candles: rows };
    },
    env,
  );

  const specDescription = "A strategy: market, one entry rule (exits on the opposite signal), optional take profit and stop loss as a percent of price, collateral and leverage, caps and tier. Long only, decided on each daily close.";

  registerTool(
    server,
    {
      name: "run_backtest",
      title: "Run a backtest",
      description: `${specDescription} Runs it over the market's whole daily history with Ostium's fees and rollover and the risk checker on every entry, and returns what the Performance tab shows. Nothing is saved.`,
      input: SpecInputSchema,
      kind: "read",
    },
    async (input) => {
      const market = (await deps.markets()).find((m) => m.id === input.marketId);
      if (!market) throw new Error(`Unknown market ${input.marketId}. Use list_markets.`);
      const spec = specFromInput(input, market, "preview");
      const candles = await deps.candles(market.id);
      const result = runBacktest({ spec, candles, market, testnet: true });
      return { spec: { ...spec, id: undefined }, backtest: backtestView(result) };
    },
    env,
  );

  registerTool(
    server,
    {
      name: "create_strategy",
      title: "Create a strategy",
      description: `${specDescription} Saves it as a draft under the signed-in account after the risk checker accepts it against the live market, stores its first backtest, and returns the id and a link. Paper trading still needs the user's approval in Studio.`,
      input: SpecInputSchema,
      kind: "write",
    },
    async (input, caller) => {
      const market = (await deps.markets()).find((m) => m.id === input.marketId);
      if (!market) throw new Error(`Unknown market ${input.marketId}. Use list_markets.`);
      const spec = specFromInput(input, market, deps.newId());
      const [price] = await deps.prices([market.id]).catch(() => [] as Price[]);
      const reference = price && deps.reference ? await deps.reference(market.symbol, price.mid).catch(() => null) : null;
      const risk = checkRisk({
        kind: "open",
        tier: spec.tier,
        testnet: deps.testnet,
        intent: { marketId: market.id, side: "long", collateralUsd: spec.size.collateralUsd, leverage: spec.size.leverage, orderType: "market" },
        market,
        sizeUsd: spec.size.collateralUsd * spec.size.leverage,
        strategy: { strategyId: spec.id, openNotionalUsd: 0, dailyLossLimitUsd: spec.caps.dailyLossLimitUsd, lossTodayUsd: (await deps.lossTodayUsd?.(spec.id)) ?? 0 },
        reference,
        limits: { ...deps.riskLimits, maxPositionUsdPerStrategy: spec.caps.maxPositionUsd },
      });
      const blocking = risk.refusals.filter((f) => f.code !== "market-closed");
      if (blocking.length > 0) throw new Error(`The risk checker refuses this strategy. ${blocking.map((f) => f.message).join(" ")}`);
      await deps.insertStrategy(caller.userId, spec);
      const result = await deps.storeBacktest(spec, market);
      return {
        id: spec.id,
        name: spec.name,
        status: spec.status,
        appUrl: link(`/studio/strategies/${spec.id}`),
        mcpUrl: link(`/mcp/s/${spec.id}`),
        warnings: risk.refusals.filter((f) => f.code === "market-closed").map((f) => f.message),
        backtest: { verdict: backtestView(result).verdict, strategy: result.strategy, buyAndHold: { returnPct: result.buyAndHold.returnPct, maxDrawdownPct: result.buyAndHold.maxDrawdownPct } },
      };
    },
    env,
  );

  registerTool(
    server,
    {
      name: "list_strategies",
      title: "List strategies",
      description: "The signed-in account's strategies with status, latest backtest summary and links. Each strategy has its own MCP server at mcpUrl.",
      input: z.object({}),
      kind: "read",
    },
    async (_args, caller: McpCaller) => {
      const rows = await deps.listStrategies(caller.userId);
      return {
        count: rows.length,
        strategies: rows.map((s) => ({
          id: s.id,
          name: s.name,
          market: s.symbol,
          status: s.blownOut ? "blown out" : s.status === "draft" ? "backtest" : s.status,
          entry: s.spec.entry,
          exit: s.spec.exit,
          size: s.spec.size,
          caps: s.spec.caps,
          tier: s.spec.tier,
          latestBacktest: s.latest,
          updatedAt: s.updatedAt,
          appUrl: link(`/studio/strategies/${s.id}`),
          mcpUrl: link(`/mcp/s/${s.id}`),
        })),
      };
    },
    env,
  );

  registerTool(
    server,
    {
      name: "get_activity",
      title: "Get activity",
      description: "The account's activity feed: backtest trades, paper signals, fills, refusals and skips, and agent proposals, newest first.",
      input: z.object({ limit: z.number().int().min(1).max(200).optional() }),
      kind: "read",
    },
    async ({ limit }, caller) => {
      const events = await deps.activity(caller.userId, limit ?? 50);
      return { count: events.length, events: events.map((e) => ({ ...e, time: new Date(e.time).toISOString() })) };
    },
    env,
  );
}
