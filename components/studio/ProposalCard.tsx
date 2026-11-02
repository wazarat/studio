"use client";

import { useState, useTransition } from "react";

import { decideProposalAction } from "@/app/(app)/studio/strategies/actions";
import { Button } from "@/components/ui/Button";
import { specDiff } from "@/lib/proposals/decide";
import type { Proposal } from "@/lib/proposals/types";
import type { BacktestResult, BacktestSummary } from "@/lib/strategies/backtest";
import type { StrategySpec } from "@/lib/strategies/spec";
import { verdict } from "@/lib/strategies/verdict";
import { cn } from "@/lib/utils";
import { formatAgo, formatUsd } from "@/lib/venues/format";

/**
 * A pending proposal from an agent (step 6): what changes, why, and its
 * backtest beside the current one, with Accept and Reject. Only the
 * user's click applies anything.
 */
const pct = (v: number) => `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(1)}%`;
const signed = (v: number) => `${v >= 0 ? "+" : "−"}${formatUsd(Math.abs(v))}`;

const ROWS: [string, (s: BacktestSummary) => string][] = [
  ["Return", (s) => pct(s.returnPct)],
  ["Max drawdown", (s) => `${s.maxDrawdownPct.toFixed(1)}%`],
  ["Trades", (s) => String(s.trades)],
  ["Win rate", (s) => `${s.winRatePct.toFixed(0)}%`],
  ["Fees", (s) => formatUsd(s.feesUsd)],
  ["Net", (s) => signed(s.netPnlUsd)],
];

export function ProposalCard({
  proposal,
  currentSpec,
  currentBacktest,
  strategyStatus,
  now,
  onDecided,
}: {
  proposal: Proposal;
  currentSpec: StrategySpec;
  currentBacktest: BacktestResult | null;
  strategyStatus: StrategySpec["status"];
  now: number;
  onDecided: (status: "accepted" | "rejected", note: string) => void;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const diff = proposal.kind === "change" && proposal.proposedSpec ? specDiff(currentSpec, proposal.proposedSpec) : [];
  const title =
    proposal.kind === "change" ? "Proposed change" : proposal.kind === "paper-start" ? "Asks to start paper trading" : "Asks to stop paper trading";
  const blocked = proposal.kind === "change" && strategyStatus !== "draft";

  const decide = (action: "accept" | "reject") =>
    start(async () => {
      setError(null);
      const res = await decideProposalAction(proposal.id, action);
      if (!res.ok) setError(res.error);
      else onDecided(res.status, res.note);
    });

  return (
    <div className="border-b border-ink-700/40 bg-ink-900/60 px-4 py-3 text-xs">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-medium text-ink-50">
          {title} <span className="font-normal text-ink-400">from {proposal.clientName ?? "an agent"}, {formatAgo(proposal.createdAt, now)}</span>
        </p>
        <div className="flex gap-2">
          <Button size="sm" disabled={pending || blocked} onClick={() => decide("accept")}>
            {pending ? "Working…" : proposal.kind === "change" ? "Accept change" : proposal.kind === "paper-start" ? "Start paper trading" : "Stop paper trading"}
          </Button>
          <Button size="sm" variant="secondary" disabled={pending} onClick={() => decide("reject")}>
            Reject
          </Button>
        </div>
      </div>
      <p className="mt-1 text-ink-300">{proposal.reason}</p>
      {blocked ? <p className="mt-1 text-ink-400">The strategy is on paper. Stop it before accepting a change.</p> : null}
      {error ? <p className="mt-1 text-rose-400">{error}</p> : null}
      {diff.length > 0 ? (
        <ul className="mt-2 grid gap-x-6 gap-y-0.5 sm:grid-cols-2">
          {diff.map((d) => (
            <li key={d.field} className="flex justify-between gap-3 tabular-nums">
              <span className="text-ink-500">{d.field}</span>
              <span className="text-ink-200">
                {d.from} <span className="text-ink-500">→</span> <span className="text-ink-50">{d.to}</span>
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      {proposal.backtest ? (
        <div className="mt-2 overflow-x-auto rounded-lg border border-ink-700/60">
          <table className="w-full text-left text-xs">
            <thead className="text-ink-500">
              <tr>
                <th className="px-3 py-1.5 font-medium"></th>
                <th className="px-3 py-1.5 text-right font-medium">Proposed</th>
                <th className="px-3 py-1.5 text-right font-medium">Current</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-700/40 text-ink-200">
              {ROWS.map(([label, f]) => (
                <tr key={label}>
                  <td className="px-3 py-1 text-ink-400">{label}</td>
                  <td className={cn("px-3 py-1 text-right tabular-nums text-ink-50")}>{f(proposal.backtest!.strategy)}</td>
                  <td className="px-3 py-1 text-right tabular-nums">{currentBacktest ? f(currentBacktest.strategy) : "–"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="px-3 py-1.5 text-[11px] text-ink-400">{verdict(proposal.backtest)}</p>
        </div>
      ) : null}
    </div>
  );
}
