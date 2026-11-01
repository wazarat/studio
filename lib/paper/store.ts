import type { PriceComparison } from "@/lib/chainlink/compare";
import type { RiskLimits } from "@/lib/risk/check";
import type { StrategySpec } from "@/lib/strategies/spec";
import type { Candle, Market, Price } from "@/lib/venues/types";

/**
 * What the paper runner needs from storage and the venue (Studio step 5),
 * as interfaces so the runner is pure and tests use an in-memory store.
 * Every store method is a single retry-safe write: the Neon store has no
 * transactions, so claims, opens and closes are guarded statements that
 * say whether they won.
 */

export type CloseReason = "signal" | "take-profit" | "stop-loss" | "liquidation" | "stopped" | "blown-out";
export type RunOutcome = "hold" | "entered" | "exited" | "refused";
export type ActivityKind = "signal" | "fill" | "refusal" | "close" | "skip";

export interface PaperStrategy {
  id: string;
  ownerId: string;
  name: string;
  symbol: string;
  marketId: string;
  status: StrategySpec["status"];
  spec: StrategySpec;
  /** ms epoch when paper trading started; null when never started. */
  paperSince: number | null;
  /** Set when equity fell below the venue's minimum collateral on paper. */
  blownOutAt?: number | null;
}

export interface PaperPosition {
  id: string;
  strategyId: string;
  ownerId: string;
  marketId: string;
  symbol: string;
  entryPrice: number;
  notionalUsd: number;
  collateralUsd: number;
  leverage: number;
  liquidationPrice: number;
  takeProfit?: number;
  stopLoss?: number;
  openFeeUsd: number;
  oracleFeeUsd: number;
  rolloverPerDayUsd: number;
  rolloverUsd: number;
  daysHeld: number;
  /** YYYY-MM-DD, the last UTC day rollover was charged through. */
  rolloverThrough: string;
  entryCandleDate: string;
  openedAt: number;
  closedAt: number | null;
  closeReason?: CloseReason;
  exitPrice?: number;
  pricePnlUsd?: number;
  feesUsd?: number;
  realisedPnlUsd?: number;
}

export type NewPosition = Omit<PaperPosition, "id" | "closedAt" | "closeReason" | "exitPrice" | "pricePnlUsd" | "feesUsd" | "realisedPnlUsd">;

export interface CloseFields {
  closedAt: number;
  reason: CloseReason;
  exitPrice: number;
  pricePnlUsd: number;
  feesUsd: number;
  realisedPnlUsd: number;
}

export interface NewActivity {
  strategyId: string;
  ownerId: string;
  mode: "paper";
  kind: ActivityKind;
  positionId?: string;
  candleDate?: string;
  price?: number;
  sizeUsd?: number;
  feesUsd?: number;
  pnlUsd?: number;
  reason: string;
  meta?: Record<string, unknown>;
  /** Same key twice is a silent no-op. */
  dedupeKey?: string;
  time: number;
}

export interface ActivityRow extends NewActivity {
  id: string;
}

export interface PaperStore {
  /** Status paper, plus any strategy that still has an open paper position. */
  paperStrategies(): Promise<PaperStrategy[]>;
  openPositions(): Promise<PaperPosition[]>;
  finishedRuns(strategyIds: string[], candleDate: string): Promise<Set<string>>;
  /** True when this call owns the run: fresh, or a claim older than ten minutes that never finished. */
  claimRun(strategyId: string, candleDate: string, nowMs: number): Promise<boolean>;
  finishRun(strategyId: string, candleDate: string, outcome: RunOutcome, note?: string): Promise<void>;
  /** Null when the strategy already has an open position. */
  openPosition(p: NewPosition): Promise<PaperPosition | null>;
  /** Compare-and-set on rolloverThrough; false when another tick accrued first. */
  accrueRollover(id: string, from: string, to: string, days: number, chargeUsd: number): Promise<boolean>;
  /** Null when the position was already closed. */
  closePosition(id: string, c: CloseFields): Promise<PaperPosition | null>;
  recordActivity(row: NewActivity): Promise<void>;
  /** Realised loss on that UTC day as a positive number. */
  lossForDay(strategyId: string, day: string): Promise<number>;
  upsertDailyResult(strategyId: string, day: string): Promise<void>;
  /** Starting balance plus realised, minus the collateral of open positions. */
  availableCollateral(ownerId: string): Promise<number>;
  /** Realised PnL of this strategy's positions opened since `sinceMs`. */
  realisedSince(strategyId: string, sinceMs: number): Promise<number>;
  /** Marks the strategy blown out and takes it off paper. */
  markBlownOut(strategyId: string, nowMs: number): Promise<void>;
}

export interface PriceSource {
  prices(marketIds: string[]): Promise<Price[]>;
}

export interface TickDeps {
  store: PaperStore;
  prices: PriceSource;
  markets(): Promise<Market[]>;
  /** Completed daily candles, full history, as of `nowMs`. */
  candles(marketId: string, nowMs: number): Promise<Candle[]>;
  reference?(symbol: string, mid: number): Promise<PriceComparison | null>;
  testnet: boolean;
  riskLimits?: Partial<RiskLimits>;
}

export interface TickReport {
  at: number;
  positionsChecked: number;
  exits: number;
  runs: number;
  entries: number;
  refusals: number;
  skips: number;
  errors: string[];
  lines: string[];
}
