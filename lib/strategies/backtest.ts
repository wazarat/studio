import { checkRisk, type RiskFinding, type RiskLimits } from "@/lib/risk/check";
import { signals, type Signal } from "@/lib/strategies/indicators";
import { LIQUIDATION_LOSS_FRACTION, warmupCandles, type StrategySpec } from "@/lib/strategies/spec";
import type { Candle, Market } from "@/lib/venues/types";

/**
 * The backtest engine (Studio step 4): a pure function on daily candles.
 * Costs are the step-3 model (opening fee in bps of notional, a flat oracle
 * fee per order, builder fee 0, rollover per calendar day), and every
 * simulated open goes through the same risk checker the bot will use.
 *
 * Rules, stated once: signals are read on a candle's close and filled at
 * the next candle's open; one position at a time with a fixed notional
 * (collateral × leverage, no compounding); the stop loss and liquidation
 * are checked before the take profit inside a bar, at the level or at the
 * open when the bar gaps through it; rollover accrues for every calendar
 * day between consecutive candles, so weekend gaps still cost; whatever is
 * open on the last candle is closed at its close.
 */

export type MarketSnapshot = Pick<Market, "symbol" | "limits" | "openInterest" | "hours" | "fees" | "rollover8h">;

export interface CandleSource {
  /** Daily candles, ascending, open times at 00:00 UTC in ms, from the venue's own first candle. */
  daily(marketId: string, fromMs: number, toMs: number): Promise<Candle[]>;
}

export interface BacktestInput {
  spec: StrategySpec;
  candles: Candle[];
  /** Fees, rollover and limits as of now, fixed for the whole run. */
  market: MarketSnapshot;
  /** Default true: Chainlink findings can only be notes in a simulation. */
  testnet?: boolean;
  riskLimits?: Partial<RiskLimits>;
}

export type ExitReason = "signal" | "take-profit" | "stop-loss" | "liquidation" | "end";

export interface TradeFees {
  openUsd: number;
  oracleUsd: number;
  rolloverUsd: number;
  builderUsd: number;
  totalUsd: number;
}

export interface BacktestTrade {
  entryIndex: number;
  entryTime: number;
  entryPrice: number;
  exitIndex: number;
  exitTime: number;
  exitPrice: number;
  exitReason: ExitReason;
  notionalUsd: number;
  collateralUsd: number;
  leverage: number;
  liquidationPrice: number;
  takeProfit?: number;
  stopLoss?: number;
  /** Calendar days charged rollover. */
  daysHeld: number;
  pricePnlUsd: number;
  fees: TradeFees;
  netPnlUsd: number;
}

export interface SkippedSignal {
  index: number;
  time: number;
  refusals: RiskFinding[];
}

export interface EquityPoint {
  time: number;
  /** Start collateral, less fees, plus realised and unrealised PnL. */
  equityUsd: number;
  unrealisedUsd: number;
  buyAndHoldUsd: number;
}

export interface BacktestSummary {
  returnPct: number;
  maxDrawdownPct: number;
  trades: number;
  winRatePct: number;
  feesUsd: number;
  netPnlUsd: number;
  finalEquityUsd: number;
}

export interface BacktestCosts {
  notionalUsd: number;
  openBps: number;
  openFeeUsd: number;
  oracleFeeUsd: number;
  builderFeeUsd: number;
  rollover8hPct: number;
  rolloverPerDayUsd: number;
  liquidationRule: string;
  fillRule: string;
}

export interface BacktestResult {
  specId: string;
  /** The venue's first candle: where history begins. Always shown. */
  historyStart: number;
  windowStart: number;
  windowEnd: number;
  candleCount: number;
  warmupCandles: number;
  firstTradableIndex: number;
  firstTradableTime: number;
  costs: BacktestCosts;
  strategy: BacktestSummary;
  buyAndHold: BacktestSummary & { trade: BacktestTrade | null };
  trades: BacktestTrade[];
  skipped: SkippedSignal[];
  equity: EquityPoint[];
}

export class BacktestError extends Error {
  readonly code: "not-enough-candles";
  constructor(code: "not-enough-candles", message: string) {
    super(message);
    this.name = "BacktestError";
    this.code = code;
  }
}

const DAY_MS = 86_400_000;

interface OpenPosition {
  entryIndex: number;
  entryPrice: number;
  liquidationPrice: number;
  takeProfit?: number;
  stopLoss?: number;
  rolloverUsd: number;
  daysHeld: number;
}

interface Run {
  trades: BacktestTrade[];
  skipped: SkippedSignal[];
  equity: { equityUsd: number; unrealisedUsd: number }[];
}

interface Costs {
  notional: number;
  openFee: number;
  oracleFee: number;
  rolloverPerDay: number;
}

function simulate(
  input: BacktestInput,
  costs: Costs,
  decide: (j: number, open: boolean, lossTodayUsd: number) => Signal | "refused",
  skippedOut: SkippedSignal[] | null,
  exits: { takeProfitPct?: number; stopLossPct?: number },
): Run {
  const { spec, candles } = input;
  const n = candles.length;
  const { collateralUsd, leverage } = spec.size;
  const N = costs.notional;
  const trades: BacktestTrade[] = [];
  const equity: Run["equity"] = [];
  let ledger = collateralUsd;
  let pos: OpenPosition | null = null;
  let pendingEntry = false;
  let pendingExit = false;

  const close = (j: number, price: number, reason: ExitReason) => {
    const p = pos!;
    const liquidated = reason === "liquidation";
    const pricePnlUsd = liquidated ? -collateralUsd : (N * (price - p.entryPrice)) / p.entryPrice;
    const oracleUsd = liquidated ? costs.oracleFee : 2 * costs.oracleFee;
    ledger += pricePnlUsd - (liquidated ? 0 : costs.oracleFee);
    const fees: TradeFees = {
      openUsd: costs.openFee,
      oracleUsd,
      rolloverUsd: p.rolloverUsd,
      builderUsd: 0,
      totalUsd: costs.openFee + oracleUsd + p.rolloverUsd,
    };
    trades.push({
      entryIndex: p.entryIndex,
      entryTime: candles[p.entryIndex].time,
      entryPrice: p.entryPrice,
      exitIndex: j,
      exitTime: candles[j].time,
      exitPrice: price,
      exitReason: reason,
      notionalUsd: N,
      collateralUsd,
      leverage,
      liquidationPrice: p.liquidationPrice,
      takeProfit: p.takeProfit,
      stopLoss: p.stopLoss,
      daysHeld: p.daysHeld,
      pricePnlUsd,
      fees,
      netPnlUsd: pricePnlUsd - fees.totalUsd,
    });
    pos = null;
  };

  for (let j = 0; j < n; j++) {
    const c = candles[j];

    // Rollover for the calendar days since the previous candle.
    if (pos && j > pos.entryIndex) {
      const days = Math.max(1, Math.round((c.time - candles[j - 1].time) / DAY_MS));
      const charge = days * costs.rolloverPerDay;
      pos.rolloverUsd += charge;
      pos.daysHeld += days;
      ledger -= charge;
    }

    // Fills at this candle's open, decided on the previous close.
    if (pendingEntry) {
      pendingEntry = false;
      const entryPrice = c.open;
      pos = {
        entryIndex: j,
        entryPrice,
        liquidationPrice: entryPrice * (1 - LIQUIDATION_LOSS_FRACTION / leverage),
        takeProfit: exits.takeProfitPct !== undefined ? entryPrice * (1 + exits.takeProfitPct / 100) : undefined,
        stopLoss: exits.stopLossPct !== undefined ? entryPrice * (1 - exits.stopLossPct / 100) : undefined,
        rolloverUsd: 0,
        daysHeld: 0,
      };
      ledger -= costs.openFee + costs.oracleFee;
    } else if (pendingExit) {
      pendingExit = false;
      if (pos) close(j, c.open, "signal");
    }

    // Intrabar exits, downside first.
    if (pos) {
      const p: OpenPosition = pos;
      const floor = Math.max(p.stopLoss ?? -Infinity, p.liquidationPrice);
      if (c.low <= floor) {
        if (p.stopLoss !== undefined && p.stopLoss >= p.liquidationPrice) close(j, Math.min(p.stopLoss, c.open), "stop-loss");
        else close(j, Math.min(p.liquidationPrice, c.open), "liquidation");
      } else if (p.takeProfit !== undefined && c.high >= p.takeProfit) {
        close(j, Math.max(p.takeProfit, c.open), "take-profit");
      }
    }

    // Decisions on this close.
    if (j === n - 1) {
      if (pos) close(j, c.close, "end");
    } else {
      const lossTodayUsd = trades
        .filter((t) => t.exitIndex === j && t.netPnlUsd < 0)
        .reduce((s, t) => s - t.netPnlUsd, 0);
      const d = decide(j, pos !== null, lossTodayUsd);
      if (d === "exit" && pos) pendingExit = true;
      else if (d === "enter" && !pos) pendingEntry = true;
      else if (d === "refused" && skippedOut) {
        // the caller records the refusal
      }
    }

    const unrealisedUsd = pos ? (N * (c.close - pos.entryPrice)) / pos.entryPrice : 0;
    equity.push({ equityUsd: ledger + unrealisedUsd, unrealisedUsd });
  }

  return { trades, skipped: skippedOut ?? [], equity };
}

function summarise(start: number, trades: BacktestTrade[], curve: number[]): BacktestSummary {
  const netPnlUsd = trades.reduce((s, t) => s + t.netPnlUsd, 0);
  const feesUsd = trades.reduce((s, t) => s + t.fees.totalUsd, 0);
  let peak = start;
  let maxDd = 0;
  for (const e of curve) {
    peak = Math.max(peak, e);
    if (peak > 0) maxDd = Math.max(maxDd, (peak - e) / peak);
  }
  const wins = trades.filter((t) => t.netPnlUsd > 0).length;
  return {
    returnPct: (netPnlUsd / start) * 100,
    maxDrawdownPct: maxDd * 100,
    trades: trades.length,
    winRatePct: trades.length ? (wins / trades.length) * 100 : 0,
    feesUsd,
    netPnlUsd,
    finalEquityUsd: start + netPnlUsd,
  };
}

export function runBacktest(input: BacktestInput): BacktestResult {
  const { spec, candles, market } = input;
  const warmup = warmupCandles(spec.entry);
  if (candles.length < warmup + 2) {
    throw new BacktestError(
      "not-enough-candles",
      `${spec.market.symbol} has ${candles.length} daily candles; this strategy needs at least ${warmup + 2}.`,
    );
  }
  const N = spec.size.collateralUsd * spec.size.leverage;
  const costs: Costs = {
    notional: N,
    openFee: (N * market.fees.openBps) / 10_000,
    oracleFee: market.fees.oracleFeeUsd,
    rolloverPerDay: N * (market.rollover8h.long / 100) * 3,
  };
  const sig = signals(spec.entry, candles);
  const skipped: SkippedSignal[] = [];
  const limits: Partial<RiskLimits> = { ...input.riskLimits, maxPositionUsdPerStrategy: spec.caps.maxPositionUsd };
  const marketOpen: MarketSnapshot = { ...market, hours: { ...market.hours, isOpen: true } };

  const strategyRun = simulate(
    input,
    costs,
    (j, open, lossTodayUsd) => {
      const s = sig[j];
      if (s !== "enter" || open) return s;
      const risk = checkRisk({
        kind: "open",
        tier: spec.tier,
        testnet: input.testnet ?? true,
        intent: {
          marketId: spec.market.marketId,
          side: "long",
          collateralUsd: spec.size.collateralUsd,
          leverage: spec.size.leverage,
          orderType: "market",
        },
        market: marketOpen,
        sizeUsd: N,
        strategy: {
          strategyId: spec.id,
          openNotionalUsd: 0,
          dailyLossLimitUsd: spec.caps.dailyLossLimitUsd,
          lossTodayUsd,
        },
        reference: null,
        limits,
      });
      if (risk.ok) return "enter";
      skipped.push({ index: j, time: candles[j].time, refusals: risk.refusals });
      return "refused";
    },
    skipped,
    spec.exit,
  );

  const holdRun = simulate(input, costs, (j) => (j === warmup ? "enter" : null), null, {});

  const start = spec.size.collateralUsd;
  const equity: EquityPoint[] = candles.map((c, i) => ({
    time: c.time,
    equityUsd: strategyRun.equity[i].equityUsd,
    unrealisedUsd: strategyRun.equity[i].unrealisedUsd,
    buyAndHoldUsd: holdRun.equity[i].equityUsd,
  }));

  return {
    specId: spec.id,
    historyStart: candles[0].time,
    windowStart: candles[0].time,
    windowEnd: candles[candles.length - 1].time,
    candleCount: candles.length,
    warmupCandles: warmup,
    firstTradableIndex: warmup + 1,
    firstTradableTime: candles[warmup + 1].time,
    costs: {
      notionalUsd: N,
      openBps: market.fees.openBps,
      openFeeUsd: costs.openFee,
      oracleFeeUsd: costs.oracleFee,
      builderFeeUsd: 0,
      rollover8hPct: market.rollover8h.long,
      rolloverPerDayUsd: costs.rolloverPerDay,
      liquidationRule: `entry × (1 − ${LIQUIDATION_LOSS_FRACTION} / leverage)`,
      fillRule: "signals on the close, fills at the next open; stop before target inside a bar",
    },
    strategy: summarise(start, strategyRun.trades, strategyRun.equity.map((e) => e.equityUsd)),
    buyAndHold: {
      ...summarise(start, holdRun.trades, holdRun.equity.map((e) => e.equityUsd)),
      trade: holdRun.trades[0] ?? null,
    },
    trades: strategyRun.trades,
    skipped,
    equity,
  };
}
