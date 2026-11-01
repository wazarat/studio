import type { EntryRule } from "@/lib/strategies/spec";
import type { Candle } from "@/lib/venues/types";

/**
 * Indicators on daily closes (Studio step 4). Every array is index-aligned
 * with the candles and NaN until the indicator has enough history, so a
 * signal is only ever read where both today's and yesterday's values exist.
 */

export function sma(values: number[], n: number): number[] {
  const out = new Array<number>(values.length).fill(Number.NaN);
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= n) sum -= values[i - n];
    if (i >= n - 1) out[i] = sum / n;
  }
  return out;
}

/** Wilder's RSI: defined from index n onwards. */
export function rsi(values: number[], n: number): number[] {
  const out = new Array<number>(values.length).fill(Number.NaN);
  if (values.length <= n) return out;
  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 1; i <= n; i++) {
    const d = values[i] - values[i - 1];
    if (d > 0) avgGain += d;
    else avgLoss -= d;
  }
  avgGain /= n;
  avgLoss /= n;
  const at = (g: number, l: number) => (l === 0 ? 100 : 100 - 100 / (1 + g / l));
  out[n] = at(avgGain, avgLoss);
  for (let i = n + 1; i < values.length; i++) {
    const d = values[i] - values[i - 1];
    avgGain = (avgGain * (n - 1) + Math.max(d, 0)) / n;
    avgLoss = (avgLoss * (n - 1) + Math.max(-d, 0)) / n;
    out[i] = at(avgGain, avgLoss);
  }
  return out;
}

/** Highest high of the previous `lookback` candles, excluding the current one. */
export function highestHigh(highs: number[], lookback: number): number[] {
  const out = new Array<number>(highs.length).fill(Number.NaN);
  for (let i = lookback; i < highs.length; i++) {
    let m = -Infinity;
    for (let k = i - lookback; k < i; k++) m = Math.max(m, highs[k]);
    out[i] = m;
  }
  return out;
}

export function lowestLow(lows: number[], lookback: number): number[] {
  const out = new Array<number>(lows.length).fill(Number.NaN);
  for (let i = lookback; i < lows.length; i++) {
    let m = Infinity;
    for (let k = i - lookback; k < i; k++) m = Math.min(m, lows[k]);
    out[i] = m;
  }
  return out;
}

export type Signal = "enter" | "exit" | null;

const defined = (...xs: number[]) => xs.every((x) => Number.isFinite(x));

/**
 * One signal per candle, read on its close:
 * - maCross: enter when the fast average crosses above the slow one, exit when it crosses below.
 * - rsi: enter when RSI crosses back up through `buyBelow`, exit when it crosses down through `100 - buyBelow`.
 * - breakout: enter on a close above the lookback's highest high, exit on a close below its lowest low.
 */
export function signals(entry: EntryRule, candles: Candle[]): Signal[] {
  const close = candles.map((c) => c.close);
  const out = new Array<Signal>(candles.length).fill(null);
  switch (entry.kind) {
    case "maCross": {
      const fast = sma(close, entry.fast);
      const slow = sma(close, entry.slow);
      for (let i = 1; i < candles.length; i++) {
        if (!defined(fast[i], slow[i], fast[i - 1], slow[i - 1])) continue;
        if (fast[i] > slow[i] && fast[i - 1] <= slow[i - 1]) out[i] = "enter";
        else if (fast[i] < slow[i] && fast[i - 1] >= slow[i - 1]) out[i] = "exit";
      }
      return out;
    }
    case "rsi": {
      const r = rsi(close, entry.period);
      const sellAbove = 100 - entry.buyBelow;
      for (let i = 1; i < candles.length; i++) {
        if (!defined(r[i], r[i - 1])) continue;
        if (r[i - 1] < entry.buyBelow && r[i] >= entry.buyBelow) out[i] = "enter";
        else if (r[i - 1] > sellAbove && r[i] <= sellAbove) out[i] = "exit";
      }
      return out;
    }
    case "breakout": {
      const hh = highestHigh(candles.map((c) => c.high), entry.lookback);
      const ll = lowestLow(candles.map((c) => c.low), entry.lookback);
      for (let i = 0; i < candles.length; i++) {
        if (!defined(hh[i], ll[i])) continue;
        if (close[i] > hh[i]) out[i] = "enter";
        else if (close[i] < ll[i]) out[i] = "exit";
      }
      return out;
    }
  }
}
