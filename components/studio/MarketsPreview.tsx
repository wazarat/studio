"use client";

import { useLivePrices } from "@/components/studio/useLivePrices";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/lib/venues/format";
import type { Market, Price } from "@/lib/venues/types";

/**
 * A short markets list for the dashboard (Studio step 4b): the headline
 * markets with their live price, 24h change and whether they are open.
 * Live only for admins; everyone else sees the page-load prices.
 */
const HEADLINE = ["BTC/USD", "ETH/USD", "XAU/USD", "NVDA/USD", "EUR/USD", "US500/USD"];

export function MarketsPreview({ markets, prices, changes, live }: { markets: Market[]; prices: Price[]; changes: Record<string, number>; live: boolean }) {
  const stream = useLivePrices(prices, live);
  const rows = HEADLINE.map((s) => markets.find((m) => m.symbol === s)).filter((m): m is Market => Boolean(m));
  return (
    <ul className="divide-y divide-ink-700/40 rounded-lg border border-ink-700/60">
      {rows.map((m) => {
        const p = stream.prices[m.id];
        const change = changes[m.id];
        const open = p?.isOpen ?? m.hours.isOpen;
        return (
          <li key={m.id} className="flex items-center justify-between gap-3 px-3 py-2 text-xs">
            <span>
              <span className={cn("font-medium", open ? "text-ink-100" : "text-ink-400")}>{m.symbol}</span>
              <span className="ml-2 text-ink-500">{open ? "Open" : "Closed"}</span>
            </span>
            <span className="tabular-nums">
              <span className="text-ink-200">{p ? formatPrice(p.mid) : "–"}</span>
              <span className={cn("ml-3", change === undefined ? "text-ink-500" : change < 0 ? "text-rose-400" : "text-ink-400")}>
                {change === undefined ? "–" : `${change >= 0 ? "+" : "−"}${Math.abs(change).toFixed(2)}%`}
              </span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
