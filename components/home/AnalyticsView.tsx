"use client";

import { useState } from "react";

import { BarChart } from "@/components/ui/BarChart";
import { ANALYTICS_CHAINS, ANALYTICS_CHAIN_KEYS, type AnalyticsChain } from "@/content/analytics";
import type { AnalyticsData, ChartMetric } from "@/lib/dune";
import { formatAsOf, formatDayShort, formatPct, formatUnit } from "@/lib/format";
import { cn } from "@/lib/utils";

type Range = "24h" | "all";

function DeltaLine({ pct }: { pct: number | null }) {
  if (pct === null) return null;
  return (
    <p className={cn("text-xs font-medium", pct >= 0 ? "text-signal-400" : "text-red-400")}>
      {formatPct(pct)} from prior day
    </p>
  );
}

function RangeToggle({ range, onChange }: { range: Range; onChange: (r: Range) => void }) {
  return (
    <div className="glass inline-flex rounded-full p-0.5" role="group" aria-label="Time range">
      {(["24h", "all"] as const).map((r) => (
        <button
          key={r}
          type="button"
          aria-pressed={range === r}
          onClick={() => onChange(r)}
          className={cn(
            "rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors",
            range === r ? "bg-electric-500/25 text-ink-50" : "text-ink-300 hover:text-ink-100",
          )}
        >
          {r === "24h" ? "24h" : "All time"}
        </button>
      ))}
    </div>
  );
}

function ChartCard({ metric }: { metric: ChartMetric }) {
  const [range, setRange] = useState<Range>("24h");
  const points = range === "24h" ? metric.daily14 : metric.allTime;
  const hasData = metric.allTime.length > 0;

  return (
    <div className="glass card-lift rounded-xl border border-ink-700/60 p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <h3 className="font-display text-lg font-semibold tracking-tight text-ink-50">
            {metric.label}
          </h3>
          <p className="text-xs leading-relaxed text-ink-400">
            {range === "24h"
              ? "Recent daily context with the latest completed day highlighted."
              : metric.description}
          </p>
        </div>
        <div className="font-display text-xl font-semibold tracking-tight text-ink-50 tabular">
          {hasData ? formatUnit(metric.latest, metric.unit) : "n/a"}
        </div>
      </div>
      <div className="mt-5">
        <BarChart
          points={points}
          ariaLabel={`${metric.label}, ${range === "24h" ? "last 14 days" : "all time"}`}
        />
      </div>
      <div className="mt-4">
        <RangeToggle range={range} onChange={setRange} />
      </div>
    </div>
  );
}

function ChainToggle({ chain, onChange }: { chain: AnalyticsChain; onChange: (c: AnalyticsChain) => void }) {
  return (
    <div className="glass inline-flex rounded-full p-0.5" role="group" aria-label="Chain">
      {ANALYTICS_CHAIN_KEYS.map((c) => (
        <button
          key={c}
          type="button"
          aria-pressed={chain === c}
          onClick={() => onChange(c)}
          className={cn(
            "rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors",
            chain === c ? "bg-electric-500/25 text-ink-50" : "text-ink-300 hover:text-ink-100",
          )}
        >
          {ANALYTICS_CHAINS[c].toggle}
        </button>
      ))}
    </div>
  );
}

export function AnalyticsView({ chains }: { chains: Record<AnalyticsChain, AnalyticsData> }) {
  const [chain, setChain] = useState<AnalyticsChain>("robinhood");
  const data = chains[chain];
  const copy = ANALYTICS_CHAINS[chain];
  const latestCompleteDay = data.charts.find((c) => c.daily14.length > 0)?.daily14.at(-1)?.date;
  const caption = data.updatedAt
    ? `Updated ${formatAsOf(data.updatedAt)}${latestCompleteDay ? `, latest complete day ${formatDayShort(latestCompleteDay)} UTC` : ""}`
    : "Live data unavailable. Showing the last captured snapshot.";

  return (
    <section className="space-y-6">
      {/* Summary card: header, stat strip, provenance footnote */}
      <div className="glass rounded-xl border border-ink-700/60 p-6 md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-xl space-y-2">
            <p className="kicker">Protocol analytics</p>
            <h2 className="font-display text-3xl font-semibold tracking-tight text-ink-50">
              {copy.title}
            </h2>
            <p className="text-sm leading-relaxed text-ink-300">
              {copy.lead}
            </p>
            <p className="pt-1 font-mono text-[11px] text-ink-400">{caption}</p>
          </div>
          <ChainToggle chain={chain} onChange={setChain} />
        </div>

        {/* gap-px over a divider-colored backdrop draws clean cell borders at every breakpoint */}
        <div className="mt-6 grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-ink-700/60 bg-ink-700/60 sm:grid-cols-2 lg:grid-cols-4">
          {data.stats.map((stat) => (
            <div key={stat.id} className="space-y-1.5 bg-ink-900 p-5">
              <p className="text-xs font-medium uppercase tracking-wider text-ink-300">
                {stat.label}
              </p>
              <p className="font-display text-3xl font-semibold tracking-tight text-ink-50 tabular">
                {stat.formatted}
              </p>
              <DeltaLine pct={stat.change24hPct} />
            </div>
          ))}
        </div>

        <p className="mt-4 text-xs leading-relaxed text-ink-500">
          {copy.footnote}
        </p>
      </div>

      {/* Chart cards */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {data.charts.map((chart) => (
          <ChartCard key={chart.id} metric={chart} />
        ))}
      </div>
    </section>
  );
}
