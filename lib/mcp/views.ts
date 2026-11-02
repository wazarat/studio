import type { BacktestResult } from "@/lib/strategies/backtest";
import { historyWindow, verdict } from "@/lib/strategies/verdict";
import { LIMITED_BELOW_USD } from "@/lib/risk/check";
import { marketShort } from "@/lib/venues/names";
import type { Market } from "@/lib/venues/types";

/** Answer shapes shared by both servers (step 6). Pure. */

export function marketView(m: Market, prices?: Map<string, { mid: number; isOpen: boolean }>) {
  const p = prices?.get(m.id);
  return {
    id: m.id,
    pair: m.symbol,
    name: marketShort(m, "simple"),
    class: m.category,
    open: p?.isOpen ?? m.hours.isOpen,
    price: p?.mid ?? null,
    maxLeverage: m.limits.maxLeverage,
    overnightMaxLeverage: m.limits.overnightMaxLeverage || null,
    openFeeBps: m.fees.openBps,
    oracleFeeUsd: m.fees.oracleFeeUsd,
    rollover8hPct: m.rollover8h.long,
    maxSizeNowUsd: Math.round(m.limits.maxSizeNowUsd),
    limited: m.limits.maxSizeNowUsd < LIMITED_BELOW_USD,
    note: "Synthetic perpetual on Ostium: you trade the price, nothing is owned.",
  };
}

export function backtestView(r: BacktestResult, trades = 200) {
  const w = historyWindow(r);
  const day = (ms: number) => new Date(ms).toISOString().slice(0, 10);
  return {
    verdict: verdict(r),
    history: { start: day(r.historyStart), end: day(r.windowEnd), candles: r.candleCount, window: `${w.label}, ${w.span}`, short: w.short },
    strategy: r.strategy,
    buyAndHold: { ...r.buyAndHold, trade: r.buyAndHold.trade ? { entry: day(r.buyAndHold.trade.entryTime), entryPrice: r.buyAndHold.trade.entryPrice, exitPrice: r.buyAndHold.trade.exitPrice } : null },
    costs: r.costs,
    refusedSignals: r.skipped.length,
    trades: r.trades.slice(-trades).map((t) => ({
      entry: day(t.entryTime),
      entryPrice: t.entryPrice,
      exit: day(t.exitTime),
      exitPrice: t.exitPrice,
      reason: t.exitReason,
      daysHeld: t.daysHeld,
      pricePnlUsd: t.pricePnlUsd,
      feesUsd: t.fees.totalUsd,
      netPnlUsd: t.netPnlUsd,
    })),
  };
}
