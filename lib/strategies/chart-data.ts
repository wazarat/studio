import type { BacktestResult } from "@/lib/strategies/backtest";
import { highestHigh, lowestLow, rsi, sma } from "@/lib/strategies/indicators";
import type { EntryRule } from "@/lib/strategies/spec";
import type { Candle } from "@/lib/venues/types";

/**
 * What the chart draws (Studio step 4b), computed with the engine's own
 * indicator functions on the same candles, so a marker always sits where
 * the drawn lines cross or break. Pure.
 */

export type ChartColor = "electric" | "neon" | "signal" | "muted" | "text";

export interface Overlay {
  key: string;
  title: string;
  /** Index-aligned with the candles; NaN draws a gap. */
  values: number[];
  color: ChartColor;
  dashed?: boolean;
}

export interface Pane {
  key: "rsi";
  title: string;
  values: number[];
  lines: { value: number; title: string }[];
  range: [number, number];
}

export interface ChartMarker {
  time: number;
  kind: "entry" | "exit" | "refused";
  text: string;
  source?: "backtest" | "paper";
}

const DAY_MS = 86_400_000;

/** UTC calendar day as the chart's business-day string. */
export function toChartTime(ms: number): string {
  return new Date(ms - (ms % DAY_MS)).toISOString().slice(0, 10);
}

export function overlaysFor(entry: EntryRule, candles: Candle[]): Overlay[] {
  const close = candles.map((c) => c.close);
  switch (entry.kind) {
    case "maCross":
      return [
        { key: "fast", title: `MA ${entry.fast}`, values: sma(close, entry.fast), color: "electric" },
        { key: "slow", title: `MA ${entry.slow}`, values: sma(close, entry.slow), color: "neon" },
      ];
    case "breakout":
      return [
        { key: "high", title: `${entry.lookback}d high`, values: highestHigh(candles.map((c) => c.high), entry.lookback), color: "electric", dashed: true },
        { key: "low", title: `${entry.lookback}d low`, values: lowestLow(candles.map((c) => c.low), entry.lookback), color: "muted", dashed: true },
      ];
    case "rsi":
      return [];
  }
}

export function paneFor(entry: EntryRule, candles: Candle[]): Pane | null {
  if (entry.kind !== "rsi") return null;
  return {
    key: "rsi",
    title: `RSI ${entry.period}`,
    values: rsi(candles.map((c) => c.close), entry.period),
    lines: [
      { value: entry.buyBelow, title: String(entry.buyBelow) },
      { value: 100 - entry.buyBelow, title: String(100 - entry.buyBelow) },
    ],
    range: [0, 100],
  };
}

const REASON: Record<string, string> = {
  signal: "signal",
  "take-profit": "take profit",
  "stop-loss": "stop loss",
  liquidation: "liquidated",
  end: "end",
  "blown-out": "blown out",
};

export function markersFor(result: BacktestResult | null): ChartMarker[] {
  if (!result) return [];
  const out: ChartMarker[] = [];
  for (const t of result.trades) {
    out.push({ time: t.entryTime, kind: "entry", text: "long" });
    out.push({ time: t.exitTime, kind: "exit", text: REASON[t.exitReason] ?? t.exitReason });
  }
  for (const s of result.skipped) out.push({ time: s.time, kind: "refused", text: "refused" });
  return out.sort((a, b) => a.time - b.time || (a.kind === "entry" ? -1 : 1));
}

export interface EquitySeries {
  strategy: { time: number; value: number }[];
  buyAndHold: { time: number; value: number }[];
  start: number;
}

export function equitySeriesFor(result: BacktestResult, start: number): EquitySeries {
  return {
    strategy: result.equity.map((p) => ({ time: p.time, value: p.equityUsd })),
    buyAndHold: result.equity.map((p) => ({ time: p.time, value: p.buyAndHoldUsd })),
    start,
  };
}
