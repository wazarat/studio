import { Plus } from "lucide-react";
import Link from "next/link";

import { MarketsPreview } from "@/components/studio/MarketsPreview";
import { Button } from "@/components/ui/Button";
import { Card, CardSection } from "@/components/ui/Card";
import { STUDIO_COPY } from "@/content/studio";
import type { DashboardData } from "@/lib/strategies/dashboard";
import { TEMPLATES } from "@/lib/strategies/templates";
import { cn } from "@/lib/utils";
import { formatAgo, formatUsd } from "@/lib/venues/format";

/**
 * The Studio home as a trader's dashboard (Studio step 4b): the account
 * strip, the strategies table, the activity feed, and for an empty
 * account the headline markets with three templates. Server-rendered;
 * only the markets list is a client island for live prices.
 */
const TH = "px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wide text-ink-500";
const TD = "px-3 py-2.5";

function day(ms: number): string {
  const d = new Date(ms);
  return `${d.getUTCDate()} ${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d.getUTCMonth()]}`;
}
const pct = (v: number) => `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(1)}%`;

function countdown(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `in ${h}h ${m}m` : `in ${m}m`;
}

export function Dashboard({ data, admin }: { data: DashboardData; admin: boolean }) {
  const now = data.at;
  const hasRows = data.rows.length > 0;
  return (
    <div className="container space-y-8 py-8 md:py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl">
          <h1 className="font-display text-3xl font-semibold tracking-tight text-ink-50 md:text-4xl">{STUDIO_COPY.kicker}</h1>
          <p className="mt-2 text-sm leading-relaxed text-ink-400">{STUDIO_COPY.subtitle}</p>
        </div>
        {admin ? (
          <Button asChild>
            <Link href="/studio/strategies/new">
              <Plus aria-hidden className="h-4 w-4" />
              {STUDIO_COPY.newStrategy}
            </Link>
          </Button>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {(
          [
            [
              STUDIO_COPY.strip.accountValue,
              formatUsd(data.paper?.accountValueUsd ?? 0),
              data.paper ? `Paper · cash ${formatUsd(data.paper.balanceUsd)} of ${formatUsd(data.paper.startingUsd, 0)}` : STUDIO_COPY.strip.note,
            ],
            [
              STUDIO_COPY.strip.today,
              `${(data.paper?.todayUsd ?? 0) < 0 ? "−" : "+"}${formatUsd(Math.abs(data.paper?.todayUsd ?? 0))}`,
              data.paper ? "Realised today plus open positions at the current price" : STUDIO_COPY.strip.note,
            ],
            [
              STUDIO_COPY.strip.openPositions,
              String(data.paper?.open.length ?? 0),
              data.paper && data.paper.open.length > 0
                ? data.paper.open
                    .slice(0, 2)
                    .map((p) => `${p.symbol} ${p.unrealisedUsd === null ? "" : `${p.unrealisedUsd >= 0 ? "+" : "−"}$${Math.abs(p.unrealisedUsd).toFixed(2)}`}`)
                    .join(" · ")
                : data.paper
                  ? "No paper position open"
                  : STUDIO_COPY.strip.note,
            ],
          ] as const
        ).map(([label, value, note]) => (
          <Card key={label}>
            <CardSection className="py-4">
              <p className="text-[11px] uppercase tracking-wide text-ink-500">{label}</p>
              <p className="mt-1 font-display text-2xl font-semibold tabular-nums text-ink-50">{value}</p>
              <p className="mt-1 text-[11px] text-ink-500">{note}</p>
            </CardSection>
          </Card>
        ))}
      </div>

      {admin && !data.storage ? <p className="text-sm text-rose-400">{STUDIO_COPY.storage}</p> : null}

      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-lg font-semibold text-ink-50">
            {STUDIO_COPY.table.title}
            {hasRows ? <span className="ml-2 text-sm font-normal text-ink-400">{data.rows.length}</span> : null}
          </h2>
          <p className="text-xs text-ink-500">Next check at daily close, {countdown(data.nextCheckAt - now)}</p>
        </div>
        {hasRows ? (
          <div className="overflow-x-auto rounded-lg border border-ink-700/60">
            <table className="w-full text-xs">
              <thead>
                <tr>
                  <th className={TH}>Strategy</th>
                  <th className={TH}>Market</th>
                  <th className={TH}>Status</th>
                  <th className={cn(TH, "text-right")}>Return</th>
                  <th className={cn(TH, "text-right")}>Max drawdown</th>
                  <th className={TH}>Open position</th>
                  <th className={TH}>Last signal</th>
                  <th className={TH}>Next check</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-700/40 text-ink-200">
                {data.rows.map((r) => (
                  <tr key={r.id} className="hover:bg-ink-800/30">
                    <td className={TD}>
                      <Link href={`/studio/strategies/${r.id}`} className="font-medium text-ink-50 hover:text-electric-300 hover:underline">
                        {r.name}
                      </Link>
                      <span className="ml-2 text-ink-500">{r.rule}</span>
                    </td>
                    <td className={TD}>{r.symbol}</td>
                    <td className={cn(TD, r.status === "paper" && "text-signal-400")}>{r.status}</td>
                    <td className={cn(TD, "text-right tabular-nums text-ink-100")}>{r.returnPct === null ? "–" : pct(r.returnPct)}</td>
                    <td className={cn(TD, "text-right tabular-nums")}>{r.maxDrawdownPct === null ? "–" : `${r.maxDrawdownPct.toFixed(1)}%`}</td>
                    <td className={TD}>{r.openPosition ?? "None"}</td>
                    <td className={TD}>{r.lastSignal ? `${r.lastSignal.kind} on ${day(r.lastSignal.time)}` : "–"}</td>
                    <td className={cn(TD, "text-ink-400")}>Daily close</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-ink-400">{admin ? STUDIO_COPY.table.empty : STUDIO_COPY.soon}</p>
        )}
      </section>

      <div className={cn("grid gap-8", hasRows ? "lg:grid-cols-[minmax(0,1fr)_22rem]" : "lg:grid-cols-2")}>
        {hasRows ? (
          <section className="space-y-3">
            <h2 className="font-display text-lg font-semibold text-ink-50">{STUDIO_COPY.feed.title}</h2>
            {data.activity.length === 0 ? (
              <p className="text-sm text-ink-400">{STUDIO_COPY.feed.empty}</p>
            ) : (
              <ul className="divide-y divide-ink-700/40 rounded-lg border border-ink-700/60">
                {data.activity.map((e) => (
                  <li key={e.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 px-3 py-2 text-xs">
                    <span className="w-20 shrink-0 tabular-nums text-ink-500">{day(e.time)}</span>
                    <Link href={`/studio/strategies/${e.strategyId}`} className="shrink-0 font-medium text-ink-100 hover:underline">
                      {e.strategyName}
                    </Link>
                    <span className={cn("min-w-0 flex-1", e.kind === "refused" ? "text-ink-400" : "text-ink-200")}>{e.text}</span>
                    <span className="text-[10px] uppercase tracking-wide text-ink-500">{e.source}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : (
          <section className="space-y-3">
            <h2 className="font-display text-lg font-semibold text-ink-50">{STUDIO_COPY.templates.title}</h2>
            <ul className="space-y-2">
              {TEMPLATES.map((t) => {
                const inner = (
                  <>
                    <p className="text-sm font-medium text-ink-50">{t.title}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-ink-400">{t.blurb}</p>
                    <p className="mt-1 font-mono text-[11px] text-ink-500">
                      {t.symbol} · {formatUsd(t.draft.size.collateralUsd, 0)} at {t.draft.size.leverage}x
                    </p>
                  </>
                );
                return (
                  <li key={t.id}>
                    {admin ? (
                      <Link href={`/studio/strategies/new?template=${t.id}`} className="block rounded-lg border border-ink-700/60 bg-ink-900 px-4 py-3 transition-colors hover:border-ink-500">
                        {inner}
                      </Link>
                    ) : (
                      <div className="rounded-lg border border-ink-700/60 bg-ink-900 px-4 py-3 opacity-70">{inner}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <section className="space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 className="font-display text-lg font-semibold text-ink-50">{STUDIO_COPY.markets.title}</h2>
            <span className="text-xs text-ink-500">Read {formatAgo(data.at, now)}</span>
          </div>
          <MarketsPreview markets={data.markets} prices={data.prices} changes={data.changes} live={admin} />
          {hasRows && admin ? (
            <ul className="space-y-1 text-xs">
              {TEMPLATES.map((t) => (
                <li key={t.id}>
                  <Link href={`/studio/strategies/new?template=${t.id}`} className="text-ink-300 underline-offset-2 hover:text-ink-50 hover:underline">
                    New from {t.title}
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      </div>
    </div>
  );
}
