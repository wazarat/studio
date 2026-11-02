/**
 * The Go-live terms (Studio step 7), pure so the card and the actions
 * agree: the total USDC approval is editable within the beta cap, the
 * expiry defaults to 30 days, and the approval is shown as trades of the
 * strategy's collateral.
 */

export const BETA_MAX_TOTAL_USD = 5_000;
export const BETA_MAX_MULTIPLE = 10;
export const DEFAULT_MULTIPLE = 5;
export const DEFAULT_EXPIRY_DAYS = 30;
export const MAX_EXPIRY_DAYS = 90;
/** Below this many trades' worth of remaining approval the card asks for a top-up. */
export const LOW_APPROVAL_TRADES = 2;

export interface TermsBounds {
  minTotalUsd: number;
  maxTotalUsd: number;
  defaultTotalUsd: number;
  defaultExpiryMs: number;
  maxExpiryMs: number;
}

export function termsBounds(collateralUsd: number, nowMs: number): TermsBounds {
  const maxTotalUsd = Math.min(BETA_MAX_MULTIPLE * collateralUsd, BETA_MAX_TOTAL_USD);
  return {
    minTotalUsd: collateralUsd,
    maxTotalUsd: Math.max(collateralUsd, maxTotalUsd),
    defaultTotalUsd: Math.min(DEFAULT_MULTIPLE * collateralUsd, maxTotalUsd),
    defaultExpiryMs: nowMs + DEFAULT_EXPIRY_DAYS * 86_400_000,
    maxExpiryMs: nowMs + MAX_EXPIRY_DAYS * 86_400_000,
  };
}

/** A total cap and expiry that fit the bounds, or the reason they do not. */
export function validateTerms(collateralUsd: number, totalUsd: number, expiresAtMs: number, nowMs: number): string | null {
  const b = termsBounds(collateralUsd, nowMs);
  if (!Number.isFinite(totalUsd) || totalUsd < b.minTotalUsd) return `The total must cover at least one trade: $${b.minTotalUsd.toFixed(2)}.`;
  if (totalUsd > b.maxTotalUsd) return `During the beta the total is capped at $${b.maxTotalUsd.toFixed(2)} (${BETA_MAX_MULTIPLE}× the collateral or $${BETA_MAX_TOTAL_USD}, whichever is lower).`;
  if (!Number.isFinite(expiresAtMs) || expiresAtMs <= nowMs + 3_600_000) return "The expiry must be at least an hour away.";
  if (expiresAtMs > b.maxExpiryMs) return `The expiry can be at most ${MAX_EXPIRY_DAYS} days away.`;
  return null;
}

/** "covers about 5 trades of $100". */
export function tradesCovered(totalUsd: number, collateralUsd: number): number {
  return collateralUsd > 0 ? Math.floor(totalUsd / collateralUsd + 1e-9) : 0;
}

export function tradesText(totalUsd: number, collateralUsd: number): string {
  const n = tradesCovered(totalUsd, collateralUsd);
  return `covers ${n === 0 ? "no" : n === 1 ? "about 1 trade" : `about ${n} trades`}${n > 0 ? ` of $${collateralUsd.toFixed(0)}` : ""}`;
}

/** Remaining approval for a strategy: its cap less what it committed, never more than the wallet's allowance. */
export function remainingUsd(totalCapUsd: number, spentUsd: number, walletAllowanceUsd: number): number {
  return Math.max(0, Math.min(totalCapUsd - spentUsd, walletAllowanceUsd));
}

export function lowApproval(remaining: number, collateralUsd: number): boolean {
  return remaining < LOW_APPROVAL_TRADES * collateralUsd;
}
