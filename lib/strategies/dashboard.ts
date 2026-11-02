import "server-only";

import { listConnections, type McpConnection } from "@/lib/mcp/connections";
import { mergeActivity, paperEvent } from "@/lib/paper/activity";
import { paperActivityFor } from "@/lib/paper/store-neon";
import { loadPaperSummary, type PaperSummary } from "@/lib/paper/summary";
import { activityFromBacktests, type ActivityEvent } from "@/lib/strategies/activity";
import { latestBacktests, listStrategies, storageConfigured } from "@/lib/strategies/db";
import { loadMarkets, type MarketsBundle } from "@/lib/strategies/markets";
import { describeEntry } from "@/lib/strategies/spec";

/**
 * Everything the dashboard shows (Studio step 4b), in one load. Rows come
 * from each strategy's latest stored backtest; the next check is the next
 * daily close at 00:00 UTC, since that is the only wake trigger yet.
 */
export interface StrategyRowView {
  id: string;
  name: string;
  symbol: string;
  rule: string;
  status: "backtest" | "paper" | "live" | "blown out";
  returnPct: number | null;
  maxDrawdownPct: number | null;
  /** "Long since 12 Oct 2026" or null. */
  openPosition: string | null;
  lastSignal: { time: number; kind: "entry" | "exit" | "refused" } | null;
  historyStart: number | null;
  updatedAt: string;
}

export interface DashboardData extends MarketsBundle {
  names: "simple" | "pairs";
  rows: StrategyRowView[];
  activity: ActivityEvent[];
  nextCheckAt: number;
  storage: boolean;
  paper: PaperSummary | null;
  connections: McpConnection[];
  baseUrl: string;
}

const DAY_MS = 86_400_000;

function day(ms: number): string {
  const d = new Date(ms);
  return `${d.getUTCDate()} ${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export async function loadDashboard(userId: string | null, admin: boolean, names: "simple" | "pairs" = "simple"): Promise<DashboardData> {
  const bundle = { ...(await loadMarkets()), names, baseUrl: process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "") || "http://localhost:3000" };
  const nextCheckAt = Math.ceil(Date.now() / DAY_MS) * DAY_MS;
  const storage = storageConfigured();
  if (!admin || !userId || !storage) return { ...bundle, rows: [], activity: [], nextCheckAt, storage, paper: null, connections: [] };

  const [strategies, paper, paperRows, connections] = await Promise.all([listStrategies(userId), loadPaperSummary(userId, bundle.prices), paperActivityFor(userId, null, 50), listConnections(userId, "account")]);
  const backtests = await latestBacktests(strategies.map((s) => s.id));
  const results = new Map(Array.from(backtests, ([id, b]) => [id, b.results]));
  const byId = new Map(strategies.map((s) => [s.id, s]));
  const openByStrategy = new Map(paper.open.map((p) => [p.strategyId, p]));

  const rows: StrategyRowView[] = strategies.map((s) => {
    const r = results.get(s.id);
    const last = r?.trades[r.trades.length - 1];
    const lastSkipped = r?.skipped[r.skipped.length - 1];
    let lastSignal: StrategyRowView["lastSignal"] = null;
    if (last) lastSignal = { time: last.exitTime, kind: "exit" };
    if (lastSkipped && (!lastSignal || lastSkipped.time > lastSignal.time)) lastSignal = { time: lastSkipped.time, kind: "refused" };
    return {
      id: s.id,
      name: s.name,
      symbol: s.symbol,
      rule: describeEntry(s.spec.entry),
      status: s.blownOutAt ? "blown out" : s.status === "draft" ? "backtest" : s.status,
      // Stored results from before the blow-out stop can exceed −100%; the floor applies on display too.
      returnPct: r ? Math.max(-100, r.strategy.returnPct) : null,
      maxDrawdownPct: r ? Math.min(100, r.strategy.maxDrawdownPct) : null,
      openPosition:
        s.status === "paper" || openByStrategy.has(s.id)
          ? (() => {
              const p = openByStrategy.get(s.id);
              if (!p) return null;
              const u = p.unrealisedUsd;
              return `Long since ${day(p.openedAt)}${u === null ? "" : ` · ${u >= 0 ? "+" : "−"}$${Math.abs(u).toFixed(2)}`}`;
            })()
          : last && last.exitReason === "end"
            ? `Long since ${day(last.entryTime)} (backtest)`
            : null,
      lastSignal,
      historyStart: r ? r.historyStart : null,
      updatedAt: s.updatedAt,
    };
  });

  const paperEvents = paperRows.map((r) => {
    const s = byId.get(r.strategyId);
    return paperEvent(r, s?.name ?? "Strategy", s?.symbol ?? "");
  });
  return {
    ...bundle,
    rows,
    activity: mergeActivity(activityFromBacktests(strategies, results), paperEvents),
    nextCheckAt,
    storage,
    paper,
    connections,
  };
}
