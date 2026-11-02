import type { PriceComparison } from "@/lib/chainlink/compare";
import type { Market, OpenIntent } from "@/lib/venues/types";

/**
 * The risk checker (Studio step 3). Every open goes through `checkRisk`
 * before a transaction is built; closes always pass. It is a pure function:
 * no clock, no env, no network. Whatever it needs about the market, the
 * strategy and the Chainlink reference is handed in, so the caps are
 * provable in tests and the same code runs in the admin page and, later,
 * the bot.
 */

export type Tier = "studio" | "studio-plus";

export interface RiskLimits {
  maxLeverageByTier: Record<Tier, number>;
  /** Total open notional per strategy, USD. */
  maxPositionUsdPerStrategy: number;
  /** Share of the market's remaining open interest one trade may take. */
  maxOiShareBps: number;
  /** Chainlink deviation band, basis points. */
  referenceToleranceBps: number;
}

/** Below this "max size now" a market is tagged limited, so people learn it before the checker refuses them. */
export const LIMITED_BELOW_USD = 50;

/** The most notional one trade may open on a market right now, by the open-interest rule and the pair's own room. */
export function maxSizeNowUsd(
  remainingOiUsd: number,
  pairRoomUsd: number,
  maxOiShareBps: number = DEFAULT_RISK_LIMITS.maxOiShareBps,
): number {
  return Math.max(0, Math.min((Math.max(0, remainingOiUsd) * maxOiShareBps) / 10_000, Math.max(0, pairRoomUsd)));
}

export const DEFAULT_RISK_LIMITS: RiskLimits = {
  maxLeverageByTier: { studio: 5, "studio-plus": 15 },
  maxPositionUsdPerStrategy: 1_000,
  maxOiShareBps: 100,
  referenceToleranceBps: 50,
};

export interface StrategyRiskState {
  strategyId: string;
  /** Sum of the strategy's open position sizes, USD. */
  openNotionalUsd: number;
  /** 0 disables the stop. */
  dailyLossLimitUsd: number;
  /** Realised loss so far today as a positive number, USD. */
  lossTodayUsd: number;
}

export interface OpenRiskInput {
  kind: "open";
  tier: Tier;
  /** On testnet the Chainlink findings are shown, not enforced. */
  testnet: boolean;
  intent: OpenIntent;
  market: Pick<Market, "symbol" | "limits" | "openInterest" | "hours">;
  /** Notional of the new trade, USD (collateral × leverage after fees). */
  sizeUsd: number;
  strategy: StrategyRiskState;
  /** null when the market has no Chainlink feed. */
  reference: PriceComparison | null;
  limits?: Partial<RiskLimits>;
}

export interface CloseRiskInput {
  kind: "close";
}

export type RiskInput = OpenRiskInput | CloseRiskInput;

export type RiskCode =
  | "market-closed"
  | "leverage-over-tier"
  | "leverage-over-market"
  | "leverage-over-overnight"
  | "size-over-strategy-cap"
  | "size-over-oi-share"
  | "daily-loss-stop"
  | "reference-missing"
  | "reference-stale"
  | "reference-deviation";

export interface RiskFinding {
  code: RiskCode;
  message: string;
  limit?: number;
  actual?: number;
}

export interface RiskResult {
  ok: boolean;
  /** Any entry here means the trade is refused. */
  refusals: RiskFinding[];
  /** Shown, never blocking. */
  notes: RiskFinding[];
  applied: {
    maxLeverage: number;
    remainingStrategyUsd: number;
    remainingOiUsd: number;
  };
}

const PASS: RiskResult = {
  ok: true,
  refusals: [],
  notes: [],
  applied: { maxLeverage: 0, remainingStrategyUsd: 0, remainingOiUsd: 0 },
};

function usd(n: number): string {
  return `$${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

export function checkRisk(input: RiskInput): RiskResult {
  if (input.kind === "close") return PASS;

  const limits: RiskLimits = { ...DEFAULT_RISK_LIMITS, ...input.limits };
  const { intent, market, strategy, sizeUsd, reference } = input;
  const refusals: RiskFinding[] = [];
  const notes: RiskFinding[] = [];

  if (!market.hours.isOpen) {
    refusals.push({ code: "market-closed", message: `${market.symbol} is closed right now.` });
  }

  // Leverage: the tightest of the tier cap, the market cap and, when the
  // position would be held overnight, the overnight cap.
  const tierCap = limits.maxLeverageByTier[input.tier];
  const overnightApplies =
    market.limits.overnightMaxLeverage > 0 && (!intent.isDayTrade || market.hours.isDayTradingClosed);
  const overnightCap = overnightApplies ? market.limits.overnightMaxLeverage : Number.POSITIVE_INFINITY;
  const marketCap = market.limits.maxLeverage > 0 ? market.limits.maxLeverage : Number.POSITIVE_INFINITY;
  const maxLeverage = Math.min(tierCap, marketCap, overnightCap);

  if (intent.leverage > maxLeverage) {
    if (maxLeverage === tierCap) {
      refusals.push({
        code: "leverage-over-tier",
        message: `Leverage ${intent.leverage}x is above the ${tierCap}x ${input.tier === "studio" ? "Studio" : "Studio+"} limit.`,
        limit: tierCap,
        actual: intent.leverage,
      });
    } else if (maxLeverage === overnightCap) {
      refusals.push({
        code: "leverage-over-overnight",
        message: `Leverage ${intent.leverage}x is above ${market.symbol}'s ${overnightCap}x overnight limit.`,
        limit: overnightCap,
        actual: intent.leverage,
      });
    } else {
      refusals.push({
        code: "leverage-over-market",
        message: `Leverage ${intent.leverage}x is above ${market.symbol}'s ${marketCap}x limit.`,
        limit: marketCap,
        actual: intent.leverage,
      });
    }
  }

  // Size per strategy.
  const remainingStrategyUsd = Math.max(0, limits.maxPositionUsdPerStrategy - strategy.openNotionalUsd);
  if (strategy.openNotionalUsd + sizeUsd > limits.maxPositionUsdPerStrategy) {
    refusals.push({
      code: "size-over-strategy-cap",
      message: `${usd(sizeUsd)} would take the strategy to ${usd(strategy.openNotionalUsd + sizeUsd)}, over its ${usd(limits.maxPositionUsdPerStrategy)} cap.`,
      limit: remainingStrategyUsd,
      actual: sizeUsd,
    });
  }

  // Share of the market's remaining open interest on this side.
  const sideOi = intent.side === "long" ? market.openInterest.longUsd : market.openInterest.shortUsd;
  const remainingOiUsd = Math.max(0, market.openInterest.maxPerSideUsd - sideOi);
  const oiCap = (remainingOiUsd * limits.maxOiShareBps) / 10_000;
  if (sizeUsd > oiCap) {
    refusals.push({
      code: "size-over-oi-share",
      message: `${usd(sizeUsd)} is more than ${limits.maxOiShareBps / 100}% of the ${usd(remainingOiUsd)} open interest left on the ${intent.side} side.`,
      limit: oiCap,
      actual: sizeUsd,
    });
  }

  // Daily loss stop.
  if (strategy.dailyLossLimitUsd > 0 && strategy.lossTodayUsd >= strategy.dailyLossLimitUsd) {
    refusals.push({
      code: "daily-loss-stop",
      message: `The strategy has lost ${usd(strategy.lossTodayUsd)} today, at or past its ${usd(strategy.dailyLossLimitUsd)} daily stop.`,
      limit: strategy.dailyLossLimitUsd,
      actual: strategy.lossTodayUsd,
    });
  }

  // Chainlink reference. Missing is never a refusal; stale or out of band
  // refuses on mainnet and is only noted on testnet.
  const referenceFindings: RiskFinding[] = [];
  if (reference === null) {
    notes.push({ code: "reference-missing", message: `${market.symbol} has no Chainlink feed on Arbitrum One; the check is skipped.` });
  } else {
    if (!reference.fresh) {
      referenceFindings.push({
        code: "reference-stale",
        message: `The Chainlink price for ${market.symbol} is ${Math.round(reference.ageSeconds / 60)} minutes old.`,
        actual: reference.ageSeconds,
      });
    }
    if (!reference.withinTolerance) {
      referenceFindings.push({
        code: "reference-deviation",
        message: `Ostium's mid is ${Math.abs(reference.deviationBps).toFixed(1)} bps from Chainlink, outside the ${limits.referenceToleranceBps} bps band.`,
        limit: limits.referenceToleranceBps,
        actual: reference.deviationBps,
      });
    }
  }
  if (input.testnet) notes.push(...referenceFindings);
  else refusals.push(...referenceFindings);

  return {
    ok: refusals.length === 0,
    refusals,
    notes,
    applied: { maxLeverage, remainingStrategyUsd, remainingOiUsd },
  };
}
