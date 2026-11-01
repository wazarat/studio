import Link from "next/link";

import type { BacktestRow, StrategyRow } from "@/lib/strategies/db";
import { describeEntry } from "@/lib/strategies/spec";
import { formatUsd } from "@/lib/venues/format";

/**
 * The account's strategies as list rows in the canhav.dev language: name,
 * market and rule, size, status as words, and the latest backtest's return
 * with where its history starts.
 */
function day(ms: number | string): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function StrategyList({ strategies, backtests }: { strategies: StrategyRow[]; backtests: Map<string, BacktestRow> }) {
  return (
    <ul className="mt-10 space-y-2">
      {strategies.map((s) => {
        const b = backtests.get(s.id);
        const r = b?.results;
        return (
          <li key={s.id}>
            <Link
              href={`/studio/strategies/${s.id}`}
              className="group flex flex-wrap items-center justify-between gap-3 rounded-lg border border-ink-700/60 bg-ink-900 px-4 py-3 transition-colors hover:border-ink-500"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink-50 group-hover:text-electric-300">{s.name}</p>
                <p className="mt-0.5 font-mono text-[11px] text-ink-500">
                  {s.symbol} · {describeEntry(s.spec.entry)} · {formatUsd(s.spec.size.collateralUsd, 0)} × {s.spec.size.leverage}x · {s.status}
                </p>
              </div>
              <p className="text-xs tabular-nums text-ink-400">
                {r
                  ? `${r.strategy.returnPct >= 0 ? "+" : ""}${r.strategy.returnPct.toFixed(1)}% vs hold ${r.buyAndHold.returnPct >= 0 ? "+" : ""}${r.buyAndHold.returnPct.toFixed(1)}% · ${r.strategy.trades} trades · history from ${day(r.historyStart)}`
                  : "No backtest yet"}
              </p>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
