import "server-only";

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
  status: "backtest" | "paper" | "live";
  returnPct: number | null;
  maxDrawdownPct: number | null;
  /** "Long since 12 Oct 2026" or null. */
  openPosition: string | null;
  lastSignal: { time: number; kind: "entry" | "exit" | "refused" } | null;
  historyStart: number | null;
  updatedAt: string;
}

export interface DashboardData extends MarketsBundle {
  rows: StrategyRowView[];
  activity: ActivityEvent[];
  nextCheckAt: number;
  storage: boolean;
}

const DAY_MS = 86_400_000;

function day(ms: number): string {
  const d = new Date(ms);
  return `${d.getUTCDate()} ${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export async function loadDashboard(userId: string | null, admin: boolean): Promise<DashboardData> {
  const bundle = await loadMarkets();
  const nextCheckAt = Math.ceil(Date.now() / DAY_MS) * DAY_MS;
  const storage = storageConfigured();
  if (!admin || !userId || !storage) return { ...bundle, rows: [], activity: [], nextCheckAt, storage };

  const strategies = await listStrategies(userId);
  const backtests = await latestBacktests(strategies.map((s) => s.id));
  const results = new Map(Array.from(backtests, ([id, b]) => [id, b.results]));

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
      status: s.status === "draft" ? "backtest" : s.status,
      returnPct: r ? r.strategy.returnPct : null,
      maxDrawdownPct: r ? r.strategy.maxDrawdownPct : null,
      openPosition: last && last.exitReason === "end" ? `Long since ${day(last.entryTime)}` : null,
      lastSignal,
      historyStart: r ? r.historyStart : null,
      updatedAt: s.updatedAt,
    };
  });

  return {
    ...bundle,
    rows,
    activity: activityFromBacktests(strategies, results),
    nextCheckAt,
    storage,
  };
}
