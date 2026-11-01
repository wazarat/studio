import type { BacktestResult } from "@/lib/strategies/backtest";

/**
 * Plain-words reading of a backtest (Studio step 5): one line against buy
 * and hold, and the history window with a note until a long-history
 * vendor is plugged in. Pure.
 */
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function monthYear(ms: number): string {
  const d = new Date(ms);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

const pts = (n: number) => `${Math.abs(n).toFixed(0)} point${Math.abs(n).toFixed(0) === "1" ? "" : "s"}`;

export function verdict(result: Pick<BacktestResult, "strategy" | "buyAndHold">): string {
  const dr = result.strategy.returnPct - result.buyAndHold.returnPct;
  const dd = result.strategy.maxDrawdownPct - result.buyAndHold.maxDrawdownPct;
  const head = Math.abs(dr) < 0.5 ? "Matched buy and hold" : dr > 0 ? `Beat buy and hold by ${pts(dr)}` : `Trailed buy and hold by ${pts(dr)}`;
  const tail = Math.abs(dd) < 0.5 ? "the same drawdown" : dd < 0 ? `${pts(dd)} less drawdown` : `${pts(dd)} more drawdown`;
  return `${head} with ${tail}.`;
}

export interface HistoryWindow {
  /** "Jan 2024 to Oct 2026" */
  label: string;
  years: number;
  /** "about 2.8 years" */
  span: string;
  /** Under five years of history. */
  short: boolean;
}

const YEAR_MS = 365.25 * 86_400_000;

export function historyWindow(result: Pick<BacktestResult, "historyStart" | "windowEnd">): HistoryWindow {
  const years = (result.windowEnd - result.historyStart) / YEAR_MS;
  const span = years < 1 ? `about ${Math.round(years * 12)} months` : `about ${years.toFixed(1)} years`;
  return { label: `${monthYear(result.historyStart)} to ${monthYear(result.windowEnd)}`, years, span, short: years < 5 };
}
