import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";

import { RerunButton } from "@/components/studio/RerunButton";
import { Card, CardSection } from "@/components/ui/Card";
import { getInternalAdminGate } from "@/lib/auth";
import { loginPathFor } from "@/lib/auth-paths";
import type { BacktestSummary } from "@/lib/strategies/backtest";
import { getStrategy, latestBacktest } from "@/lib/strategies/db";
import { describeEntry } from "@/lib/strategies/spec";
import { formatAgo, formatPrice, formatUsd } from "@/lib/venues/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Strategy", robots: { index: false } };
export const dynamic = "force-dynamic";

const TABLE = "overflow-x-auto rounded-lg border border-ink-700/60";
const TH = "px-3 py-2 font-medium";
const TD = "px-3 py-2";
const NUM = "px-3 py-2 tabular-nums";

function day(ms: number | string): string {
  const d = new Date(ms);
  return `${d.getUTCDate()} ${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
const pct = (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
const signed = (v: number) => `${v >= 0 ? "+" : "−"}${formatUsd(Math.abs(v))}`;

/**
 * A saved strategy and its latest backtest (step 4). The history start
 * comes first, then strategy against buy-and-hold, the cost assumptions,
 * the trades and the signals the checker refused.
 */
export default async function StrategyPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ warn?: string }>;
}) {
  const { id } = await params;
  const { warn } = await searchParams;
  const gate = await getInternalAdminGate();
  if (gate === "signed-out") redirect(loginPathFor(`/studio/strategies/${id}`));
  if (gate !== "admin") notFound();
  const { userId } = await auth();
  const strategy = userId && /^[0-9a-f-]{36}$/.test(id) ? await getStrategy(id, userId) : null;
  if (!strategy) notFound();
  const backtest = await latestBacktest(strategy.id);
  const r = backtest?.results ?? null;
  const spec = strategy.spec;
  const now = Date.now();

  const rows: [string, (s: BacktestSummary) => string][] = [
    ["Return", (s) => pct(s.returnPct)],
    ["Max drawdown", (s) => `${s.maxDrawdownPct.toFixed(2)}%`],
    ["Trades", (s) => String(s.trades)],
    ["Win rate", (s) => `${s.winRatePct.toFixed(0)}%`],
    ["Fees paid", (s) => formatUsd(s.feesUsd)],
    ["Net PnL", (s) => signed(s.netPnlUsd)],
    ["Final equity", (s) => formatUsd(s.finalEquityUsd)],
  ];

  return (
    <div className="container space-y-8 py-10 md:py-14">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="kicker">
            <Link href="/studio" className="hover:underline">
              Studio
            </Link>{" "}
            / Strategy
          </p>
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight text-ink-50 md:text-4xl">{strategy.name}</h1>
          <p className="mt-3 text-sm text-ink-400">
            {spec.market.symbol} · long · {describeEntry(spec.entry)} · {formatUsd(spec.size.collateralUsd, 0)} × {spec.size.leverage}x · {spec.status} · {spec.tier === "studio" ? "Studio" : "Studio+"} · saved {formatAgo(new Date(strategy.createdAt).getTime(), now)}
          </p>
          {warn === "closed" ? <p className="mt-2 text-xs text-ink-400">The market was closed when this was saved; the draft is kept and the checker will refuse an open until it reopens.</p> : null}
        </div>
        {r ? (
          <p className="text-xs text-ink-400">
            Backtest run {formatAgo(new Date(backtest!.createdAt).getTime(), now)} · <RerunButton id={strategy.id} />
          </p>
        ) : null}
      </div>

      <Card>
        <CardSection>
          <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
            {(
              [
                ["Entry", describeEntry(spec.entry)],
                ["Exit", `Opposite signal${spec.exit.takeProfitPct ? `, take profit ${spec.exit.takeProfitPct}%` : ""}${spec.exit.stopLossPct ? `, stop loss ${spec.exit.stopLossPct}%` : ""}`],
                ["Wake", "Daily candle close"],
                ["Size", `${formatUsd(spec.size.collateralUsd)} at ${spec.size.leverage}x, ${formatUsd(spec.size.collateralUsd * spec.size.leverage)} notional`],
                ["Caps", `${formatUsd(spec.caps.maxPositionUsd, 0)} open, ${spec.caps.dailyLossLimitUsd ? `${formatUsd(spec.caps.dailyLossLimitUsd, 0)} daily stop` : "no daily stop"}`],
                ["Status", spec.status],
              ] as const
            ).map(([k, v]) => (
              <div key={k} className="flex items-baseline justify-between gap-4 border-b border-ink-700/40 pb-1">
                <dt className="text-ink-500">{k}</dt>
                <dd className="text-right text-ink-100">{v}</dd>
              </div>
            ))}
          </dl>
        </CardSection>
      </Card>

      {!r ? (
        <p className="text-sm text-ink-400">No backtest stored yet.</p>
      ) : (
        <>
          <section className="space-y-3">
            <h2 className="font-display text-lg font-semibold text-ink-50">Backtest</h2>
            <p className="text-sm text-ink-300">
              Ostium&apos;s daily history for {spec.market.symbol} starts on <span className="text-ink-50">{day(r.historyStart)}</span>: {r.candleCount} candles to {day(r.windowEnd)}, first trade possible from {day(r.firstTradableTime)} after a {r.warmupCandles}-candle warm-up.
            </p>
            <div className={cn(TABLE, "max-w-xl")}>
              <table className="w-full text-left text-xs">
                <thead className="text-ink-500">
                  <tr>
                    <th className={TH}></th>
                    <th className={cn(TH, "text-right")}>Strategy</th>
                    <th className={cn(TH, "text-right")}>Buy and hold</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-700/40 text-ink-200">
                  {rows.map(([label, f]) => (
                    <tr key={label}>
                      <td className={cn(TD, "text-ink-400")}>{label}</td>
                      <td className={cn(NUM, "text-right text-ink-100")}>{f(r.strategy)}</td>
                      <td className={cn(NUM, "text-right")}>{f(r.buyAndHold)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-ink-500">
              Costs: {formatUsd(r.costs.notionalUsd)} notional per trade · open fee {r.costs.openBps} bps = {formatUsd(r.costs.openFeeUsd, 4)} · oracle {formatUsd(r.costs.oracleFeeUsd)} per order · builder fee 0 · rollover {r.costs.rollover8hPct}% per 8h = {formatUsd(r.costs.rolloverPerDayUsd, 4)} per day · liquidation at {r.costs.liquidationRule} · {r.costs.fillRule}.
              {r.skipped.length > 0 ? ` The checker refused ${r.skipped.length} signal${r.skipped.length === 1 ? "" : "s"}.` : ""}
            </p>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-medium text-ink-100">Trades</h3>
            {r.trades.length === 0 ? (
              <p className="text-xs text-ink-400">No trades in this window.</p>
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
                    {r.trades.map((t) => (
                      <tr key={`${t.entryIndex}-${t.exitIndex}`}>
                        <td className={cn(TD, "whitespace-nowrap")}>{day(t.entryTime)}</td>
                        <td className={cn(NUM, "text-right")}>{formatPrice(t.entryPrice)}</td>
                        <td className={cn(TD, "whitespace-nowrap")}>{day(t.exitTime)}</td>
                        <td className={cn(NUM, "text-right")}>{formatPrice(t.exitPrice)}</td>
                        <td className={TD}>{t.exitReason}</td>
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
          </section>

          {r.skipped.length > 0 ? (
            <section className="space-y-2">
              <h3 className="text-sm font-medium text-ink-100">Refused signals</h3>
              <ul className="space-y-1 text-xs text-ink-400">
                {r.skipped.slice(0, 20).map((s) => (
                  <li key={s.index}>
                    {day(s.time)}: {s.refusals.map((f) => f.message).join(" ")}
                  </li>
                ))}
                {r.skipped.length > 20 ? <li>and {r.skipped.length - 20} more.</li> : null}
              </ul>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
