import type { Draft } from "@/lib/strategies/draft";

/**
 * Starter strategies for the dashboard's empty state (Studio step 4b).
 * Each names a symbol; the page resolves it to the venue's market id, or
 * to the first market of the same category when the symbol is not listed.
 */
export interface Template {
  id: string;
  title: string;
  blurb: string;
  symbol: string;
  category: string;
  draft: Pick<Draft, "entry" | "exit" | "size">;
}

export const TEMPLATES: readonly Template[] = [
  {
    id: "btc-trend",
    title: "BTC trend",
    blurb: "Long when the 10-day average crosses above the 30-day, out when it crosses back.",
    symbol: "BTC/USD",
    category: "crypto",
    draft: { entry: { kind: "maCross", fast: 10, slow: 30 }, exit: {}, size: { collateralUsd: 100, leverage: 2 } },
  },
  {
    id: "gold-breakout",
    title: "Gold breakout",
    blurb: "Long on a close above the 20-day high, out on a close below the 20-day low.",
    symbol: "XAU/USD",
    category: "commodities",
    draft: { entry: { kind: "breakout", lookback: 20 }, exit: { stopLossPct: 5 }, size: { collateralUsd: 100, leverage: 2 } },
  },
  {
    id: "nvda-rsi",
    title: "NVDA RSI",
    blurb: "Long when the 14-day RSI recovers above 30, out when it falls back below 70.",
    symbol: "NVDA/USD",
    category: "stocks",
    draft: { entry: { kind: "rsi", period: 14, buyBelow: 30 }, exit: { takeProfitPct: 10, stopLossPct: 6 }, size: { collateralUsd: 100, leverage: 2 } },
  },
] as const;

export function templateById(id: string | undefined): Template | undefined {
  return TEMPLATES.find((t) => t.id === id);
}
