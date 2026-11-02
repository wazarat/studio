import type { BacktestResult } from "@/lib/strategies/backtest";
import { formatPrice, formatUsd } from "@/lib/venues/format";

/**
 * The dashboard's activity feed (Studio step 4b), derived from each
 * strategy's latest backtest until paper and live trading write real
 * events. Every event says it came from a backtest.
 */
export interface ActivityEvent {
  id: string;
  strategyId: string;
  strategyName: string;
  kind: "entry" | "exit" | "refused" | "signal" | "skip" | "proposal";
  time: number;
  text: string;
  source: "backtest" | "paper" | "agent" | "live";
}

interface StrategyLike {
  id: string;
  name: string;
  symbol: string;
}

const REASON: Record<string, string> = {
  signal: "on signal",
  "take-profit": "at take profit",
  "stop-loss": "at stop loss",
  liquidation: "liquidated",
  end: "at the end of history",
  "blown-out": "blown out",
};

export function activityFromBacktests(
  strategies: StrategyLike[],
  results: Map<string, BacktestResult>,
  cap = 50,
): ActivityEvent[] {
  const out: ActivityEvent[] = [];
  for (const s of strategies) {
    const r = results.get(s.id);
    if (!r) continue;
    r.trades.forEach((t, i) => {
      out.push({
        id: `${s.id}-entry-${i}`,
        strategyId: s.id,
        strategyName: s.name,
        kind: "entry",
        time: t.entryTime,
        text: `Long ${s.symbol} at ${formatPrice(t.entryPrice)}, ${formatUsd(t.notionalUsd, 0)} at ${t.leverage}x`,
        source: "backtest",
      });
      out.push({
        id: `${s.id}-exit-${i}`,
        strategyId: s.id,
        strategyName: s.name,
        kind: "exit",
        time: t.exitTime,
        text: `Closed ${s.symbol} at ${formatPrice(t.exitPrice)} ${REASON[t.exitReason] ?? t.exitReason}, ${t.netPnlUsd >= 0 ? "+" : "−"}${formatUsd(Math.abs(t.netPnlUsd))}`,
        source: "backtest",
      });
    });
    r.skipped.forEach((k, i) => {
      out.push({
        id: `${s.id}-refused-${i}`,
        strategyId: s.id,
        strategyName: s.name,
        kind: "refused",
        time: k.time,
        text: `Checker refused ${s.symbol}: ${k.refusals.map((f) => f.message).join(" ")}`,
        source: "backtest",
      });
    });
  }
  return out.sort((a, b) => b.time - a.time).slice(0, cap);
}
