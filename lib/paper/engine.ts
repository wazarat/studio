import { checkRisk, type OpenRiskInput, type RiskLimits, type RiskResult } from "@/lib/risk/check";
import type { PriceComparison } from "@/lib/chainlink/compare";
import { tradeCosts, type MarketSnapshot } from "@/lib/strategies/backtest";
import { signals, type Signal } from "@/lib/strategies/indicators";
import { LIQUIDATION_LOSS_FRACTION, warmupCandles, type EntryRule } from "@/lib/strategies/spec";
import type { Candle, Price } from "@/lib/venues/types";
import type { CloseReason, NewPosition, PaperPosition, PaperStrategy } from "@/lib/paper/store";

/**
 * The paper engine (Studio step 5): pure decisions and arithmetic that
 * mirror the backtest exactly. Signals come from the same indicator code,
 * costs from the same cost model, and a close computes its numbers the
 * way the backtest's close does. No clock, no I/O.
 */

export const DAY_MS = 86_400_000;

export function utcDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/**
 * A `date` column as YYYY-MM-DD. The Neon driver hands dates back as JS
 * Dates parsed at local midnight, so the local getters recover the day;
 * strings pass through.
 */
export function dateFromDb(v: unknown): string {
  if (v instanceof Date) {
    const y = v.getFullYear();
    const m = String(v.getMonth() + 1).padStart(2, "0");
    const d = String(v.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return String(v).slice(0, 10);
}

/** Whole UTC days from day `a` to day `b` (YYYY-MM-DD). */
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY_MS);
}

/** The last completed candle's day and the moment it closed; never the clock. */
export function candleDateOf(candles: Candle[]): { date: string; closeMs: number } | null {
  const last = candles[candles.length - 1];
  if (!last) return null;
  return { date: utcDate(last.time), closeMs: last.time + DAY_MS };
}

/**
 * A candle is due when it closed after paper trading started, or it is
 * the one that closed within the day before the start: a strategy started
 * mid-day acts on the latest completed candle, as the bot would at its
 * first check, and never on anything older.
 */
export function isDue(closeMs: number, paperSince: number | null): boolean {
  return paperSince === null || closeMs > paperSince - DAY_MS;
}

export function signalOn(entry: EntryRule, candles: Candle[]): Signal {
  if (candles.length < warmupCandles(entry) + 2) return null;
  return signals(entry, candles)[candles.length - 1] ?? null;
}

export function planEntry(
  strategy: PaperStrategy,
  ask: number,
  market: Pick<MarketSnapshot, "fees" | "rollover8h">,
  candleDate: string,
  nowMs: number,
): NewPosition {
  const { collateralUsd, leverage } = strategy.spec.size;
  const notional = collateralUsd * leverage;
  const costs = tradeCosts(notional, market);
  const { takeProfitPct, stopLossPct } = strategy.spec.exit;
  return {
    strategyId: strategy.id,
    ownerId: strategy.ownerId,
    marketId: strategy.marketId,
    symbol: strategy.symbol,
    entryPrice: ask,
    notionalUsd: notional,
    collateralUsd,
    leverage,
    liquidationPrice: ask * (1 - LIQUIDATION_LOSS_FRACTION / leverage),
    takeProfit: takeProfitPct !== undefined ? ask * (1 + takeProfitPct / 100) : undefined,
    stopLoss: stopLossPct !== undefined ? ask * (1 - stopLossPct / 100) : undefined,
    openFeeUsd: costs.openFee,
    oracleFeeUsd: costs.oracleFee,
    rolloverPerDayUsd: costs.rolloverPerDay,
    rolloverUsd: 0,
    daysHeld: 0,
    rolloverThrough: utcDate(nowMs),
    entryCandleDate: candleDate,
    openedAt: nowMs,
  };
}

export function rolloverDue(pos: Pick<PaperPosition, "rolloverThrough" | "rolloverPerDayUsd">, today: string) {
  const days = Math.max(0, daysBetween(pos.rolloverThrough, today));
  return { days, chargeUsd: days * pos.rolloverPerDayUsd, from: pos.rolloverThrough, to: today };
}

/** Downside first, as the backtest: liquidation, stop loss, take profit, then a pending stop. */
export function decideExit(pos: PaperPosition, bid: number, stopping: boolean): CloseReason | null {
  if (bid <= pos.liquidationPrice) return "liquidation";
  if (pos.stopLoss !== undefined && bid <= pos.stopLoss) return "stop-loss";
  if (pos.takeProfit !== undefined && bid >= pos.takeProfit) return "take-profit";
  if (stopping) return "stopped";
  return null;
}

export function closeNumbers(pos: PaperPosition, exitPrice: number, reason: CloseReason) {
  const liquidated = reason === "liquidation";
  const pricePnlUsd = liquidated ? -pos.collateralUsd : (pos.notionalUsd * (exitPrice - pos.entryPrice)) / pos.entryPrice;
  const oracleUsd = liquidated ? pos.oracleFeeUsd : 2 * pos.oracleFeeUsd;
  const feesUsd = pos.openFeeUsd + oracleUsd + pos.rolloverUsd;
  return { pricePnlUsd, feesUsd, realisedPnlUsd: pricePnlUsd - feesUsd };
}

/** Mark to a price net of fees paid so far; a close would add one more oracle fee. */
export function unrealised(pos: PaperPosition, price: number): number {
  return (pos.notionalUsd * (price - pos.entryPrice)) / pos.entryPrice - (pos.openFeeUsd + pos.oracleFeeUsd + pos.rolloverUsd);
}

export function riskInputFor(
  strategy: PaperStrategy,
  market: MarketSnapshot,
  price: Price,
  lossTodayUsd: number,
  reference: PriceComparison | null,
  testnet: boolean,
  riskLimits?: Partial<RiskLimits>,
): OpenRiskInput {
  const { collateralUsd, leverage } = strategy.spec.size;
  return {
    kind: "open",
    tier: strategy.spec.tier,
    testnet,
    intent: { marketId: strategy.marketId, side: "long", collateralUsd, leverage, orderType: "market" },
    market: { ...market, hours: { ...market.hours, isOpen: price.isOpen } },
    sizeUsd: collateralUsd * leverage,
    strategy: { strategyId: strategy.id, openNotionalUsd: 0, dailyLossLimitUsd: strategy.spec.caps.dailyLossLimitUsd, lossTodayUsd },
    reference,
    limits: { ...riskLimits, maxPositionUsdPerStrategy: strategy.spec.caps.maxPositionUsd },
  };
}

export function riskFor(...args: Parameters<typeof riskInputFor>): RiskResult {
  return checkRisk(riskInputFor(...args));
}
