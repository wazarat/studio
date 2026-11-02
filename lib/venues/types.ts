/**
 * The venue layer (Studio step 3). Everything Studio knows about a trading
 * venue goes through `Venue`; Ostium is the first implementation and the
 * only one for now, but nothing outside lib/venues/ may import the SDK. Build
 * methods return unsigned transactions and never sign: CanHav never holds
 * keys, so signing belongs to the user's wallet (or the testnet dev signer).
 *
 * Numbers are plain JS numbers in USD or price units, never on-chain
 * integers, so they can cross the server-action boundary and be reasoned
 * about in the risk checker. Only `UnsignedTx.value` is a string, because it
 * is a wei amount that would overflow a number.
 */

export type VenueId = "ostium";
export type Side = "long" | "short";
export type OrderType = "market" | "limit" | "stop";
export type Hex = `0x${string}`;
export type CandleResolution = "1" | "5" | "15" | "60" | "240" | "1D";

/** Opening-hours calendar as the venue reports it; informational. */
export interface MarketSchedule {
  alwaysOpen?: boolean;
  timezone?: string;
  openingHours?: string[];
}

/** Live trading state. `isOpen` is the one the build guards use. */
export interface MarketHours {
  isOpen: boolean;
  /** Overnight window: `limits.overnightMaxLeverage` applies when true. */
  isDayTradingClosed: boolean;
  /** Seconds until `isDayTradingClosed` flips; null when not applicable. */
  secondsToToggleDayTrading: number | null;
  schedule?: MarketSchedule;
  /** ms epoch of the venue read that produced this snapshot. */
  checkedAt: number;
}

export interface MarketLimits {
  minNotionalUsd: number;
  /** Room left on each side right now, USD. Zero when the side is full. */
  maxNotionalLongUsd: number;
  maxNotionalShortUsd: number;
  minLeverage: number;
  maxLeverage: number;
  /** 0 means no overnight restriction. */
  overnightMaxLeverage: number;
  /** The most notional one Studio trade may open right now: 1% of the remaining long open interest, within the pair's own room. */
  maxSizeNowUsd: number;
}

export interface Market {
  venue: VenueId;
  /** Venue-specific id, opaque outside the venue module. */
  id: string;
  /** "BTC/USD" */
  symbol: string;
  base: string;
  quote: string;
  category: string;
  limits: MarketLimits;
  openInterest: { longUsd: number; shortUsd: number; maxPerSideUsd: number };
  fees: { openBps: number; closeBps: number; oracleFeeUsd: number };
  /** 8-hour rollover rate in percent per side; positive means the trader pays. */
  rollover8h: { long: number; short: number };
  hours: MarketHours;
}

export interface Price {
  marketId: string;
  symbol: string;
  bid: number;
  mid: number;
  ask: number;
  isOpen: boolean;
  /** ms epoch. */
  at: number;
}

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface Position {
  marketId: string;
  symbol: string;
  /** Slot index within the market; with `marketId` it names the position. */
  index: number;
  side: Side;
  sizeUsd: number;
  collateralUsd: number;
  leverage: number;
  entryPrice: number;
  liquidationPrice: number;
  unrealizedPnlUsd: number;
  takeProfit?: number;
  stopLoss?: number;
  /** ms epoch. */
  openedAt: number;
  isDayTrade: boolean;
  /** The venue's position id, shared with every fill on this position (step 7). */
  pid?: string;
}

export interface OpenIntent {
  marketId: string;
  side: Side;
  collateralUsd: number;
  leverage: number;
  orderType: OrderType;
  limitPrice?: number;
  takeProfit?: number;
  stopLoss?: number;
  slippageBps?: number;
  isDayTrade?: boolean;
}

export interface CloseIntent {
  marketId: string;
  index: number;
  /** 1 to 100. */
  closePercent: number;
}

export interface UpdateIntent {
  marketId: string;
  index: number;
  /** A price sets it, null clears it, undefined leaves it alone. */
  takeProfit?: number | null;
  stopLoss?: number | null;
  /** Positive adds collateral, negative removes it. */
  collateralDeltaUsd?: number;
}

export interface PreviewResult {
  entryPrice: number;
  midPrice: number;
  /** Dynamic spread in percent; 0 for limit orders. */
  priceImpactPct: number;
  fees: { openUsd: number; oracleUsd: number; builderUsd: number; totalUsd: number };
  /** Notional after fees, USD. */
  sizeUsd: number;
  liquidationPrice: number;
  effectiveMaxLeverage: number;
  minSizeUsd: number;
  /** The most collateral this trade could use at this leverage right now. */
  maxCollateralUsd: number;
  maxCollateralBound: string;
  isValid: boolean;
  warnings: { code: string; message: string }[];
}

export interface UnsignedTx {
  chainId: number;
  to: Hex;
  data: Hex;
  /** wei, decimal string. */
  value: string;
  from: Hex;
}

export type VenueErrorCode = "market-closed" | "unknown-market" | "no-price" | "sdk";

export class VenueError extends Error {
  readonly code: VenueErrorCode;
  constructor(code: VenueErrorCode, message: string) {
    super(message);
    this.name = "VenueError";
    this.code = code;
  }
}

export interface Venue {
  id: VenueId;
  markets(): Promise<Market[]>;
  prices(marketIds?: string[]): Promise<Price[]>;
  /**
   * Live prices over the venue's own stream. Returns the function that
   * unsubscribes. Meant for a long-lived process; a serverless handler
   * should pair it with the request's abort signal.
   */
  subscribePrices(marketIds: string[], onPrice: (price: Price) => void): () => void;
  candles(marketId: string, resolution: CandleResolution, fromMs: number, toMs?: number): Promise<Candle[]>;
  positions(trader: Hex): Promise<Position[]>;
  /** Refuses with `market-closed` before asking the venue. */
  previewOpen(intent: OpenIntent): Promise<PreviewResult>;
  /** Refuses with `market-closed` before any transaction is built. */
  buildOpen(trader: Hex, intent: OpenIntent): Promise<UnsignedTx>;
  buildClose(trader: Hex, intent: CloseIntent): Promise<UnsignedTx>;
  /** One transaction per change: take profit, stop loss and collateral each on their own. */
  buildUpdate(trader: Hex, intent: UpdateIntent): Promise<UnsignedTx[]>;
}
