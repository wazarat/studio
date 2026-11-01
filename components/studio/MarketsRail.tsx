"use client";

import { useMemo, useState } from "react";

import { inputClasses } from "@/components/ui/Input";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/lib/venues/format";
import type { Market, Price } from "@/lib/venues/types";

/**
 * The markets rail (Studio step 4b): search, a tab per venue category,
 * and one row per market with its live price, 24h change and whether it
 * is open. Selecting a market keeps the rule and reloads the chart.
 */
const TABS: { key: string; label: string }[] = [
  { key: "all", label: "All" },
  { key: "crypto", label: "Crypto" },
  { key: "stocks", label: "Stocks" },
  { key: "indices", label: "Indices" },
  { key: "forex", label: "FX" },
  { key: "commodities", label: "Commodities" },
  { key: "etf", label: "ETFs" },
];

export function MarketsRail({
  markets,
  prices,
  changes,
  selectedId,
  onSelect,
}: {
  markets: Market[];
  prices: Record<string, Price>;
  changes: Record<string, number>;
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const [tab, setTab] = useState("all");
  const [q, setQ] = useState("");
  const rows = useMemo(() => {
    const needle = q.trim().toUpperCase();
    return markets.filter((m) => (tab === "all" || m.category === tab) && (!needle || m.symbol.toUpperCase().includes(needle)));
  }, [markets, tab, q]);
  const present = new Set(markets.map((m) => m.category));

  return (
    <div className="flex h-full flex-col">
      <div className="space-y-2 border-b border-ink-700/40 p-3">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search markets" className={cn(inputClasses, "py-1.5 text-xs")} aria-label="Search markets" />
        <div className="flex flex-wrap gap-1">
          {TABS.filter((t) => t.key === "all" || present.has(t.key)).map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={cn("rounded-md px-2 py-1 text-[11px] font-medium transition-colors", tab === t.key ? "bg-ink-800/60 text-ink-50" : "text-ink-400 hover:text-ink-200")}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <ul className="min-h-0 flex-1 overflow-y-auto">
        {rows.map((m) => {
          const p = prices[m.id];
          const open = p?.isOpen ?? m.hours.isOpen;
          const change = changes[m.id];
          const selected = m.id === selectedId;
          return (
            <li key={m.id}>
              <button
                type="button"
                onClick={() => onSelect(m.id)}
                className={cn("flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs transition-colors hover:bg-ink-800/40", selected && "bg-ink-800/60")}
              >
                <span className="min-w-0">
                  <span className={cn("block font-medium", selected ? "text-electric-300" : "text-ink-100", !open && "text-ink-400")}>{m.symbol}</span>
                  <span className="block text-[10px] text-ink-500">{open ? "Open" : "Closed"}</span>
                </span>
                <span className="text-right tabular-nums">
                  <span className="block text-ink-200">{p ? formatPrice(p.mid) : "–"}</span>
                  <span className={cn("block text-[10px]", change === undefined ? "text-ink-500" : change < 0 ? "text-rose-400" : "text-ink-400")}>
                    {change === undefined ? "–" : `${change >= 0 ? "+" : "−"}${Math.abs(change).toFixed(2)}%`}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
        {rows.length === 0 ? <li className="px-3 py-4 text-xs text-ink-500">No markets match.</li> : null}
      </ul>
    </div>
  );
}
