import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";

import { registerTool, type RegistrarEnv } from "@/lib/mcp/register";
import { SpecPatchSchema, applyPatch, inputFromSpec, specFromInput } from "@/lib/mcp/spec-input";
import { backtestView } from "@/lib/mcp/views";
import type { PriceComparison } from "@/lib/chainlink/compare";
import type { PaperForStrategy } from "@/lib/paper/summary";
import { specDiff } from "@/lib/proposals/decide";
import { MAX_PENDING_PER_STRATEGY, type NewProposal, type Proposal } from "@/lib/proposals/types";
import { checkRisk, type RiskLimits } from "@/lib/risk/check";
import { runBacktest, type BacktestResult } from "@/lib/strategies/backtest";
import type { StrategySpec } from "@/lib/strategies/spec";
import type { Candle, Market, Price } from "@/lib/venues/types";

/**
 * One strategy's server (step 6). Reads answer about that strategy only,
 * after an ownership check on every call. propose_change,
 * request_paper_start and request_paper_stop store a pending proposal for
 * the user to accept in Studio; nothing here edits, starts or stops.
 */
export interface StrategyRow {
  id: string;
  ownerId: string;
  name: string;
  symbol: string;
  marketId: string;
  status: StrategySpec["status"];
  spec: StrategySpec;
  paperSince: number | null;
  blownOutAt: number | null;
  updatedAt: string;
}

export interface StrategyDeps {
  getStrategy(id: string, ownerId: string): Promise<StrategyRow | null>;
  latestBacktest(id: string): Promise<{ results: BacktestResult; createdAt: string } | null>;
  paperFor(ownerId: string, row: StrategyRow): Promise<PaperForStrategy>;
  markets(): Promise<Market[]>;
  prices(ids: string[]): Promise<Price[]>;
  candles(marketId: string): Promise<Candle[]>;
  insertProposal(p: NewProposal): Promise<Proposal>;
  pendingProposals(strategyId: string): Promise<Proposal[]>;
  reference?(symbol: string, mid: number): Promise<PriceComparison | null>;
  lossTodayUsd?(strategyId: string): Promise<number>;
  testnet: boolean;
  riskLimits?: Partial<RiskLimits>;
}

export const STRATEGY_TOOL_NAMES = ["get_strategy", "get_backtest", "get_paper_results", "get_positions", "propose_change", "request_paper_start", "request_paper_stop"] as const;

const NOT_YOURS = "No strategy with that id in this account.";

export function registerStrategyTools(server: McpServer, strategyId: string, deps: StrategyDeps, env: RegistrarEnv): void {
  const link = `${env.appUrl}/studio/strategies/${strategyId}`;
  const own = async (ownerId: string) => {
    const row = await deps.getStrategy(strategyId, ownerId);
    if (!row) throw new Error(NOT_YOURS);
    return row;
  };
  const statusWord = (row: StrategyRow) => (row.blownOutAt ? "blown out" : row.status === "draft" ? "backtest" : row.status);

  registerTool(
    server,
    { name: "get_strategy", title: "Get the strategy", description: "The strategy's spec, status, paper start and pending proposals.", input: z.object({}), kind: "read" },
    async (_a, caller) => {
      const row = await own(caller.userId);
      const pending = await deps.pendingProposals(strategyId);
      return {
        id: row.id,
        name: row.name,
        market: row.symbol,
        status: statusWord(row),
        paperSince: row.paperSince ? new Date(row.paperSince).toISOString() : null,
        spec: inputFromSpec(row.spec),
        pendingProposals: pending.map((p) => ({ id: p.id, kind: p.kind, reason: p.reason, createdAt: new Date(p.createdAt).toISOString() })),
        appUrl: link,
      };
    },
    env,
  );

  registerTool(
    server,
    { name: "get_backtest", title: "Get the latest backtest", description: "The stored backtest the strategy page shows, with trades.", input: z.object({ trades: z.number().int().min(0).max(500).optional() }), kind: "read" },
    async ({ trades }, caller) => {
      await own(caller.userId);
      const b = await deps.latestBacktest(strategyId);
      if (!b) return { backtest: null, appUrl: link };
      return { ranAt: b.createdAt, backtest: backtestView(b.results, trades ?? 200), appUrl: link };
    },
    env,
  );

  registerTool(
    server,
    { name: "get_paper_results", title: "Get paper results", description: "Paper trading since start: realised result, closed positions, and the strategy's paper activity.", input: z.object({}), kind: "read" },
    async (_a, caller) => {
      const row = await own(caller.userId);
      const paper = await deps.paperFor(caller.userId, row);
      return {
        status: statusWord(row),
        since: paper.since ? new Date(paper.since).toISOString() : null,
        realisedSinceStartUsd: paper.realisedSinceStartUsd,
        closed: paper.closed.map((p) => ({ opened: new Date(p.openedAt).toISOString(), closed: p.closedAt ? new Date(p.closedAt).toISOString() : null, entryPrice: p.entryPrice, exitPrice: p.exitPrice, reason: p.closeReason, feesUsd: p.feesUsd, realisedPnlUsd: p.realisedPnlUsd })),
        activity: paper.activity.slice(0, 50).map((a) => ({ time: new Date(a.time).toISOString(), kind: a.kind, reason: a.reason, price: a.price, pnlUsd: a.pnlUsd })),
        appUrl: link,
      };
    },
    env,
  );

  registerTool(
    server,
    { name: "get_positions", title: "Get open positions", description: "The open paper position with its live mark, or none.", input: z.object({}), kind: "read" },
    async (_a, caller) => {
      const row = await own(caller.userId);
      const paper = await deps.paperFor(caller.userId, row);
      if (!paper.open) return { open: null, appUrl: link };
      const [price] = await deps.prices([paper.open.marketId]).catch(() => [] as Price[]);
      const mid = price?.mid ?? null;
      const p = paper.open;
      const unrealised = mid ? (p.notionalUsd * (mid - p.entryPrice)) / p.entryPrice - (p.openFeeUsd + p.oracleFeeUsd + p.rolloverUsd) : null;
      return {
        open: { market: p.symbol, side: "long", entryPrice: p.entryPrice, notionalUsd: p.notionalUsd, collateralUsd: p.collateralUsd, leverage: p.leverage, liquidationPrice: p.liquidationPrice, takeProfit: p.takeProfit ?? null, stopLoss: p.stopLoss ?? null, opened: new Date(p.openedAt).toISOString(), markPrice: mid, unrealisedUsd: unrealised },
        appUrl: link,
      };
    },
    env,
  );

  const proposeGuard = async (strategyId: string) => {
    const pending = await deps.pendingProposals(strategyId);
    if (pending.length >= MAX_PENDING_PER_STRATEGY) throw new Error(`There are already ${pending.length} proposals waiting on this strategy. Ask the user to decide them first.`);
    return pending;
  };

  registerTool(
    server,
    {
      name: "propose_change",
      title: "Propose a change",
      description: "Proposes changes to the strategy with a reason. The change is backtested and stored for the user to accept or reject in Studio; the strategy itself is not edited. Only the fields you send change.",
      input: z.object({ patch: SpecPatchSchema, reason: z.string().trim().min(1).max(600).describe("Why, in plain words, for the user.") }),
      kind: "write",
    },
    async ({ patch, reason }, caller) => {
      const row = await own(caller.userId);
      await proposeGuard(strategyId);
      const merged = applyPatch(inputFromSpec(row.spec), patch);
      const market = (await deps.markets()).find((m) => m.id === merged.marketId);
      if (!market) throw new Error(`Unknown market ${merged.marketId}. Use list_markets on the account server.`);
      const spec = specFromInput(merged, market, row.id, row.status);
      const diff = specDiff(row.spec, spec);
      if (diff.length === 0) throw new Error("The patch changes nothing.");
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
      if (blocking.length > 0) throw new Error(`The risk checker refuses this change. ${blocking.map((f) => f.message).join(" ")}`);
      const candles = await deps.candles(market.id);
      const backtest = runBacktest({ spec, candles, market, testnet: true });
      const proposal = await deps.insertProposal({ strategyId, ownerId: caller.userId, kind: "change", proposedSpec: spec, reason, backtest, clientId: caller.clientId, clientName: caller.clientName });
      return {
        proposalId: proposal.id,
        status: "pending",
        changes: diff,
        backtest: { verdict: backtestView(backtest).verdict, strategy: backtest.strategy, buyAndHold: { returnPct: backtest.buyAndHold.returnPct, maxDrawdownPct: backtest.buyAndHold.maxDrawdownPct } },
        note: row.status === "paper" ? "The strategy is on paper; the user has to stop it before this change can be accepted." : "Waiting for the user to accept or reject in Studio.",
        reviewUrl: link,
      };
    },
    env,
  );

  const requestPaper = (kind: "paper-start" | "paper-stop") => async ({ reason }: { reason: string }, caller: { userId: string; clientId: string; clientName: string }) => {
    const row = await own(caller.userId);
    if (kind === "paper-start" && row.status !== "draft") throw new Error(`The strategy is already ${row.status}.`);
    if (kind === "paper-stop" && row.status !== "paper") throw new Error("The strategy is not on paper.");
    const pending = await proposeGuard(strategyId);
    if (pending.some((p) => p.kind === kind)) throw new Error("That request is already waiting for the user.");
    const proposal = await deps.insertProposal({ strategyId, ownerId: caller.userId, kind, proposedSpec: null, reason, backtest: null, clientId: caller.clientId, clientName: caller.clientName });
    return { proposalId: proposal.id, status: "pending", note: "Waiting for the user to approve in Studio.", reviewUrl: link };
  };

  registerTool(
    server,
    { name: "request_paper_start", title: "Request paper trading", description: "Asks the user to start paper trading this strategy. Nothing starts until they approve in Studio.", input: z.object({ reason: z.string().trim().min(1).max(600) }), kind: "write" },
    requestPaper("paper-start"),
    env,
  );
  registerTool(
    server,
    { name: "request_paper_stop", title: "Request a paper stop", description: "Asks the user to stop paper trading this strategy. Nothing stops until they approve in Studio.", input: z.object({ reason: z.string().trim().min(1).max(600) }), kind: "write" },
    requestPaper("paper-stop"),
    env,
  );
}
