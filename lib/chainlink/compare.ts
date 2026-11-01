/**
 * The Chainlink comparison, pure so the risk checker and the internal page
 * share one arithmetic and it can be tested without a chain. A reading is
 * fresh when its age is within the feed's heartbeat plus a grace period;
 * heartbeats differ a lot (an hour for crypto, a day for forex and metals),
 * so one fixed limit would call every forex feed stale.
 */

export interface ChainlinkReading {
  /** Ostium symbol, e.g. "BTC/USD". */
  symbol: string;
  feed: `0x${string}`;
  price: number;
  /** Unix seconds from latestRoundData. */
  updatedAt: number;
  ageSeconds: number;
  heartbeatSeconds: number;
  fresh: boolean;
}

export interface PriceComparison {
  symbol: string;
  venueMid: number;
  referencePrice: number;
  /** Signed, venue relative to reference: +10 means the venue is 0.1% above. */
  deviationBps: number;
  ageSeconds: number;
  fresh: boolean;
  withinTolerance: boolean;
}

export const DEFAULT_TOLERANCE_BPS = 50;
/** Added to a feed's heartbeat before a reading counts as stale. */
export const FRESHNESS_GRACE_SECONDS = 15 * 60;

export function isFresh(ageSeconds: number, heartbeatSeconds: number, graceSeconds = FRESHNESS_GRACE_SECONDS): boolean {
  return ageSeconds >= 0 && ageSeconds <= heartbeatSeconds + graceSeconds;
}

export function deviationBps(venueMid: number, referencePrice: number): number {
  if (!(referencePrice > 0) || !Number.isFinite(venueMid)) return Number.POSITIVE_INFINITY;
  return ((venueMid - referencePrice) / referencePrice) * 10_000;
}

export function compareToReference(
  venueMid: number,
  reading: ChainlinkReading,
  toleranceBps: number = DEFAULT_TOLERANCE_BPS,
): PriceComparison {
  const dev = deviationBps(venueMid, reading.price);
  return {
    symbol: reading.symbol,
    venueMid,
    referencePrice: reading.price,
    deviationBps: dev,
    ageSeconds: reading.ageSeconds,
    fresh: reading.fresh,
    withinTolerance: Number.isFinite(dev) && Math.abs(dev) <= toleranceBps,
  };
}
