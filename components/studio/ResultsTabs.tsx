"use client";

import { useMemo, useState } from "react";

import { EquityChart } from "@/components/charts/dynamic";
import { paperEvent } from "@/lib/paper/activity";
import type { PaperForStrategy } from "@/lib/paper/summary";
import type { BacktestResult, BacktestSummary } from "@/lib/strategies/backtest";
import { equitySeriesFor } from "@/lib/strategies/chart-data";
import { historyWindow, verdict } from "@/lib/strategies/verdict";
import { cn } from "@/lib/utils";
import { formatPrice, formatUsd } from "@/lib/venues/format";

/**
 * The strategy tester's bottom tabs (Studio step 4b): Performance,
 * Trades and Costs for the result on screen.
 */
const TABLE = "overflow-x-auto rounded-lg border border-ink-700/60";
const TH = "px-3 py-2 font-medium";
const TD = "px-3 py-2";
const NUM = "px-3 py-2 tabular-nums";

function day(ms: number): string {
  const d = new Date(ms);
  return `${d.getUTCDate()} ${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
const pct = (v: number) => `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(2)}%`;
const signed = (v: number) => `${v >= 0 ? "+" : "−"}${formatUsd(Math.abs(v))}`;

type Tab = "performance" | "trades" | "costs" | "paper";

export function ResultsTabs({ result, error, startUsd, paper, symbol }: { result: BacktestResult | null; error: string | null; startUsd: number; paper: PaperForStrategy | null; symbol: string }) {
  const [tab, setTab] = useState<Tab>("performance");
  const series = useMemo(() => (result ? equitySeriesFor(result, startUsd) : null), [result, startUsd]);

  const rows: [string, (s: BacktestSummary) => string][] = [
    ["Return", (s) => pct(s.returnPct)],
    ["Max drawdown", (s) => `${s.maxDrawdownPct.toFixed(2)}% · ${formatUsd(s.maxDrawdownUsd)}`],
    ["Trades", (s) => String(s.trades)],
    ["Win rate", (s) => `${s.winRatePct.toFixed(0)}%`],
    ["Opening fees", (s) => formatUsd(s.openingFeesUsd)],
    ["Rollover", (s) => (s.rolloverUsd < 0 ? `${formatUsd(-s.rolloverUsd)} received` : `${formatUsd(s.rolloverUsd)} paid`)],
    ["Net PnL", (s) => signed(s.netPnlUsd)],
    ["Final equity", (s) => formatUsd(s.finalEquityUsd)],
  ];
  const window = result ? historyWindow(result) : null;
  const hold = result?.buyAndHold.trade ?? null;

  return (
    <div className="border-t border-ink-700/40">
      <div className="flex items-center gap-1 border-b border-ink-700/40 px-3">
        {(["performance", "trades", "costs", ...(paper ? (["paper"] as Tab[]) : [])] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn("-mb-px border-b-2 px-3 py-2 text-xs font-medium capitalize transition-colors", tab === t ? "border-electric-500 text-ink-50" : "border-transparent text-ink-400 hover:text-ink-200")}
          >
            {t}
          </button>
        ))}
        {result ? (
          <span className="ml-auto text-[11px] text-ink-500">
            History from {day(result.historyStart)} · {result.candleCount} daily candles to {day(result.windowEnd)}
          </span>
        ) : null}
      </div>

      {error ? <p className="p-4 text-sm text-rose-400">{error}</p> : null}
      {!result && !error ? <p className="p-4 text-sm text-ink-400">Waiting for candles.</p> : null}

      {result && tab === "performance" ? (
        <div className="space-y-3 p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
            <p className="text-sm font-medium text-ink-50">{verdict(result)}</p>
            {window ? (
              <p className="text-xs text-ink-300">
                <span className="text-ink-100">{window.label}</span>, {window.span}
                {window.short ? <span className="text-ink-400"> · short history: Ostium&apos;s daily candles start on {day(result.historyStart)}; a long-history vendor comes later.</span> : null}
              </p>
            ) : null}
          </div>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_24rem]">
          <div className="h-56 rounded-lg border border-ink-700/60 bg-ink-900">{series ? <EquityChart series={series} /> : null}</div>
          <div className={TABLE}>
            <table className="w-full text-left text-xs">
              <thead className="text-ink-500">
                <tr>
                  <th className={TH}></th>
                  <th className={cn(TH, "text-right")}>Strategy</th>
                  <th className={cn(TH, "text-right")}>
                    Buy and hold
                    {hold ? <span className="block font-normal text-ink-400">from {day(hold.entryTime)} at {formatPrice(hold.entryPrice)}</span> : null}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-700/40 text-ink-200">
                {rows.map(([label, f]) => (
                  <tr key={label}>
                    <td className={cn(TD, "text-ink-400")}>{label}</td>
                    <td className={cn(NUM, "text-right text-ink-100")}>{f(result.strategy)}</td>
                    <td className={cn(NUM, "text-right")}>{f(result.buyAndHold)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="px-3 py-2 text-[11px] text-ink-400">
              Fixed position of {formatUsd(result.costs.notionalUsd, 0)} per trade, no rebalancing. First trade possible from {day(result.firstTradableTime)} after a {result.warmupCandles}-bar warm-up.
              {result.skipped.length ? ` The checker refused ${result.skipped.length} signal${result.skipped.length === 1 ? "" : "s"}.` : ""}
            </p>
          </div>
          </div>
        </div>
      ) : null}

      {result && tab === "trades" ? (
        <div className="space-y-3 p-4">
          {result.trades.length === 0 ? (
            <p className="text-sm text-ink-400">No trades in this window.</p>
          ) : (
            <div className={TABLE}>
              <table className="w-full text-left text-xs">
                <thead className="text-ink-500">
                  <tr>
                    <th className={TH}>Entry</th>
                    <th className={cn(TH, "text-right")}>Price</th>
                    <th className={TH}>Exit</th>
                    <th className={cn(TH, "text-right")}>Price</th>
                    <th className={TH}>Reason</th>
                    <th className={cn(TH, "text-right")}>Days</th>
                    <th className={cn(TH, "text-right")}>Price PnL</th>
                    <th className={cn(TH, "text-right")}>Fees</th>
                    <th className={cn(TH, "text-right")}>Net</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-700/40 text-ink-200">
                  {result.trades.map((t) => (
                    <tr key={`${t.entryIndex}-${t.exitIndex}`}>
                      <td className={cn(TD, "whitespace-nowrap")}>{day(t.entryTime)}</td>
                      <td className={cn(NUM, "text-right")}>{formatPrice(t.entryPrice)}</td>
                      <td className={cn(TD, "whitespace-nowrap")}>{day(t.exitTime)}</td>
                      <td className={cn(NUM, "text-right")}>{formatPrice(t.exitPrice)}</td>
                      <td className={TD}>{t.exitReason.replace("-", " ")}</td>
                      <td className={cn(NUM, "text-right")}>{t.daysHeld}</td>
                      <td className={cn(NUM, "text-right", t.pricePnlUsd < 0 && "text-rose-400")}>{signed(t.pricePnlUsd)}</td>
                      <td className={cn(NUM, "text-right")}>{formatUsd(t.fees.totalUsd)}</td>
                      <td className={cn(NUM, "text-right text-ink-100", t.netPnlUsd < 0 && "text-rose-400")}>{signed(t.netPnlUsd)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {result.skipped.length > 0 ? (
            <ul className="space-y-1 text-xs text-ink-400">
              {result.skipped.slice(0, 12).map((s) => (
                <li key={s.index}>
                  {day(s.time)}: refused. {s.refusals.map((f) => f.message).join(" ")}
                </li>
              ))}
              {result.skipped.length > 12 ? <li>and {result.skipped.length - 12} more.</li> : null}
            </ul>
          ) : null}
        </div>
      ) : null}

      {tab === "paper" && paper ? (
        <div className="space-y-4 p-4">
          <h3 className="text-sm font-medium text-ink-100">
            Paper positions{paper.since ? ` since ${day(paper.since)}` : ""} · realised {signed(paper.realisedSinceStartUsd)}
          </h3>
          {paper.closed.length === 0 && !paper.open ? (
            <p className="text-sm text-ink-400">No paper positions yet. The first check is the next daily close.</p>
          ) : (
            <div className={TABLE}>
              <table className="w-full text-left text-xs">
                <thead className="text-ink-500">
                  <tr>
                    <th className={TH}>Opened</th>
                    <th className={cn(TH, "text-right")}>Entry</th>
                    <th className={TH}>Closed</th>
                    <th className={cn(TH, "text-right")}>Exit</th>
                    <th className={TH}>Reason</th>
                    <th className={cn(TH, "text-right")}>Days</th>
                    <th className={cn(TH, "text-right")}>Fees</th>
                    <th className={cn(TH, "text-right")}>Net</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-700/40 text-ink-200">
                  {[...(paper.open ? [paper.open] : []), ...paper.closed].map((p) => (
                    <tr key={p.id}>
                      <td className={cn(TD, "whitespace-nowrap")}>{day(p.openedAt)}</td>
                      <td className={cn(NUM, "text-right")}>{formatPrice(p.entryPrice)}</td>
                      <td className={cn(TD, "whitespace-nowrap")}>{p.closedAt ? day(p.closedAt) : "open"}</td>
                      <td className={cn(NUM, "text-right")}>{p.exitPrice ? formatPrice(p.exitPrice) : "–"}</td>
                      <td className={TD}>{p.closeReason?.replace("-", " ") ?? "–"}</td>
                      <td className={cn(NUM, "text-right")}>{p.daysHeld}</td>
                      <td className={cn(NUM, "text-right")}>{p.feesUsd !== undefined ? formatUsd(p.feesUsd) : formatUsd(p.openFeeUsd + p.oracleFeeUsd + p.rolloverUsd)}</td>
                      <td className={cn(NUM, "text-right text-ink-100", (p.realisedPnlUsd ?? 0) < 0 && "text-rose-400")}>{p.realisedPnlUsd !== undefined ? signed(p.realisedPnlUsd) : "–"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {paper.activity.length > 0 ? (
            <ul className="space-y-1 text-xs text-ink-300">
              {paper.activity.slice(0, 20).map((a) => {
                const e = paperEvent(a, "", symbol);
                return (
                  <li key={a.id} className="flex gap-3">
                    <span className="w-28 shrink-0 tabular-nums text-ink-500">{new Date(a.time).toISOString().slice(0, 16).replace("T", " ")}</span>
                    <span className={e.kind === "refused" || e.kind === "skip" ? "text-ink-400" : ""}>{e.text}</span>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>
      ) : null}

      {result && tab === "costs" ? (
        <dl className="grid gap-x-6 gap-y-2 p-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
          {(
            [
              ["Notional per trade", formatUsd(result.costs.notionalUsd)],
              ["Open fee", `${result.costs.openBps} bps = ${formatUsd(result.costs.openFeeUsd, 4)}`],
              ["Oracle fee", `${formatUsd(result.costs.oracleFeeUsd)} per order`],
              ["Builder fee", "0"],
              ["Rollover", `${result.costs.rollover8hPct}% per 8h = ${result.costs.rolloverPerDayUsd < 0 ? "−" : ""}${formatUsd(Math.abs(result.costs.rolloverPerDayUsd), 4)} per day`],
              ["Liquidation", result.costs.liquidationRule],
              ["Fills", result.costs.fillRule],
              ["Weekends", "Rollover accrues for every calendar day, including days without a candle."],
            ] as const
          ).map(([k, v]) => (
            <div key={k} className="flex items-baseline justify-between gap-4 border-b border-ink-700/40 pb-1">
              <dt className="text-ink-500">{k}</dt>
              <dd className="text-right text-ink-100">{v}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  );
}
