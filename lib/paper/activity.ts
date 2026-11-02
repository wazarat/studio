import type { ActivityEvent } from "@/lib/strategies/activity";
import type { ChartMarker } from "@/lib/strategies/chart-data";
import type { ActivityRow, PaperPosition } from "@/lib/paper/store";
import { formatPrice, formatUsd } from "@/lib/venues/format";

/**
 * Paper rows as feed events and chart markers (Studio step 5). Pure.
 */
const CLOSE_REASON: Record<string, string> = {
  signal: "on signal",
  "take-profit": "at take profit",
  "stop-loss": "at stop loss",
  liquidation: "liquidated",
  stopped: "on stop",
};

export function paperEvent(row: ActivityRow, strategyName: string, symbol: string): ActivityEvent {
  const signed = (v: number) => `${v >= 0 ? "+" : "−"}${formatUsd(Math.abs(v))}`;
  let kind: ActivityEvent["kind"] = "signal";
  let text = row.reason;
  switch (row.kind) {
    case "fill":
      kind = "entry";
      text = `Long ${symbol} at ${formatPrice(row.price ?? 0)}, ${formatUsd(row.sizeUsd ?? 0, 0)} notional`;
      break;
    case "close":
      kind = "exit";
      text = `Closed ${symbol} at ${formatPrice(row.price ?? 0)} ${CLOSE_REASON[row.reason] ?? row.reason}, ${signed(row.pnlUsd ?? 0)}`;
      break;
    case "refusal":
      kind = "refused";
      text = `Checker refused ${symbol}: ${row.reason}`;
      break;
    case "skip":
      kind = "skip";
      text = `Skipped ${symbol}: ${row.reason}`;
      break;
    case "signal":
      kind = "signal";
      text = `Signal on ${symbol}: ${row.reason}${row.candleDate ? ` (candle ${row.candleDate})` : ""}`;
      break;
    case "proposal":
      kind = "proposal";
      text = row.reason;
      break;
  }
  return { id: row.id, strategyId: row.strategyId, strategyName, kind, time: row.time, text, source: row.mode === "agent" ? "agent" : row.mode === "live" ? "live" : "paper" };
}

export function mergeActivity(a: ActivityEvent[], b: ActivityEvent[], cap = 50): ActivityEvent[] {
  return [...a, ...b].sort((x, y) => y.time - x.time).slice(0, cap);
}

/** Entry and exit markers for paper positions, clamped onto the last drawn candle. */
export function paperMarkersFor(positions: PaperPosition[], lastCandleTime: number | null): ChartMarker[] {
  const DAY = 86_400_000;
  const clamp = (ms: number) => {
    const dayStart = ms - (ms % DAY);
    return lastCandleTime !== null && dayStart > lastCandleTime ? lastCandleTime : dayStart;
  };
  const out: ChartMarker[] = [];
  for (const p of positions) {
    out.push({ time: clamp(p.openedAt), kind: "entry", text: "paper long", source: "paper" });
    if (p.closedAt !== null) out.push({ time: clamp(p.closedAt), kind: "exit", text: `paper ${p.closeReason ?? "exit"}`, source: "paper" });
  }
  return out.sort((x, y) => x.time - y.time);
}
