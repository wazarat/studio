import "server-only";

import {
  OrderType as SdkOrderType,
  OstiumClient,
  OstiumError,
  type Fill,
  type Order,
  type Pair,
  type Position as SdkPosition,
  type PriceTick,
  type BuiltTxRequest,
} from "@ostium/builder-sdk";

import { maxSizeNowUsd } from "@/lib/risk/check";
import {
  VenueError,
  type Candle,
  type CandleResolution,
  type CloseIntent,
  type Hex,
  type Market,
  type OpenIntent,
  type Position,
  type PreviewResult,
  type Side,
  type Price,
  type UnsignedTx,
  type UpdateIntent,
  type Venue,
} from "@/lib/venues/types";

/**
 * Ostium behind the Venue interface (Studio step 3). Reads go through the
 * SDK's read-only client; trades go through its build-only client, which
 * takes the trader's address and no key and returns calldata for the
 * trader's wallet to sign. `OSTIUM_TESTNET` (default true) is the one switch
 * between Arbitrum Sepolia and Arbitrum One.
 *
 * Pairs are cached for a short while per process so the admin page and the
 * risk checker do not hit the subgraph on every call. That cache is also the
 * source of market hours, which every build method checks before touching
 * the SDK, so no transaction is ever built for a closed market.
 */

export const ARBITRUM_ONE_CHAIN_ID = 42161;
export const ARBITRUM_SEPOLIA_CHAIN_ID = 421614;

const PAIRS_TTL_MS = 15_000;
const DEFAULT_SLIPPAGE_BPS = 25;

export function isTestnet(): boolean {
  return process.env.OSTIUM_TESTNET !== "false";
}

export function chainId(): number {
  return isTestnet() ? ARBITRUM_SEPOLIA_CHAIN_ID : ARBITRUM_ONE_CHAIN_ID;
}

/** CanHav's builder address with a fee of 0: attribution without a charge. */
export function builderConfig(): { address: Hex; feeBps: 0 } | undefined {
  const address = process.env.CANHAV_BUILDER_ADDRESS?.trim();
  return address && /^0x[0-9a-fA-F]{40}$/.test(address) ? { address: address as Hex, feeBps: 0 } : undefined;
}

function rpcUrl(): string | undefined {
  return process.env.OSTIUM_RPC_URL?.trim() || undefined;
}

/**
 * Two read clients (step 5b). Market data (pairs, prices, candles, fees,
 * rollover, previews) always comes from Arbitrum One, so backtests, paper
 * trading and the cost model see the real venue. Only what belongs to a
 * trader (positions, fills, balances, orders) and every built or signed
 * transaction follow OSTIUM_TESTNET.
 */
let dataClientPromise: Promise<OstiumClient> | null = null;
let traderClientPromise: Promise<OstiumClient> | null = null;

function dataClient(): Promise<OstiumClient> {
  dataClientPromise ??= OstiumClient.createReadOnly({ testnet: false, rpcUrl: process.env.ARBITRUM_ONE_RPC_URL?.trim() || undefined });
  return dataClientPromise;
}

function traderClient(): Promise<OstiumClient> {
  if (!isTestnet()) return dataClient();
  traderClientPromise ??= OstiumClient.createReadOnly({ testnet: true, rpcUrl: rpcUrl() });
  return traderClientPromise;
}

/** Where market data comes from, for labels. */
export const DATA_NETWORK = "Arbitrum One";
export function tradingNetwork(): string {
  return isTestnet() ? "Arbitrum Sepolia" : "Arbitrum One";
}

/** Build-only client for one trader: no key, no signing, just calldata. */
function buildClient(trader: Hex): Promise<OstiumClient> {
  return OstiumClient.createSelfAndSelf({
    traderAddress: trader,
    testnet: isTestnet(),
    rpcUrl: rpcUrl(),
    slippageBps: DEFAULT_SLIPPAGE_BPS,
    builder: builderConfig(),
  });
}

/* ---------- number helpers ---------- */

function num(value: string | number | undefined | null): number {
  if (value === undefined || value === null || value === "") return 0;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

/** A decimal string for the SDK: no exponent notation, no trailing zeros. */
export function toDec(value: number, maxDecimals = 8): string {
  if (!Number.isFinite(value)) throw new VenueError("sdk", `Not a finite number: ${value}`);
  const fixed = value.toFixed(maxDecimals);
  return fixed.includes(".") ? fixed.replace(/\.?0+$/, "") : fixed;
}

/* ---------- pairs cache ---------- */

interface PairsCache {
  at: number;
  list: Market[];
  byId: Map<string, Market>;
}

let pairsCache: PairsCache | null = null;
let pairsInflight: Promise<PairsCache> | null = null;

function toMarket(pair: Pair, at: number): Market {
  const mid = num(pair.midPx);
  return {
    venue: "ostium",
    id: String(pair.pairId),
    symbol: `${pair.pairFrom}/${pair.pairTo}`,
    base: pair.pairFrom,
    quote: pair.pairTo,
    category: pair.category,
    limits: {
      minNotionalUsd: num(pair.minNtl),
      maxNotionalLongUsd: num(pair.maxBSz) * mid,
      maxNotionalShortUsd: num(pair.maxSSz) * mid,
      minLeverage: pair.minLeverage,
      maxLeverage: pair.maxLeverage,
      overnightMaxLeverage: pair.overnightMaxLeverage,
      maxSizeNowUsd: maxSizeNowUsd(num(pair.maxOpenInterest) - num(pair.buyOpenInterest), num(pair.maxBSz) * mid),
    },
    openInterest: {
      longUsd: num(pair.buyOpenInterest),
      shortUsd: num(pair.sellOpenInterest),
      maxPerSideUsd: num(pair.maxOpenInterest),
    },
    fees: { openBps: pair.openFee, closeBps: pair.closeFee, oracleFeeUsd: num(pair.oracleFee) },
    rollover8h: { long: num(pair.rolloverRate?.long), short: num(pair.rolloverRate?.short) },
    hours: {
      isOpen: pair.isMarketOpen,
      isDayTradingClosed: pair.isDayTradingClosed,
      secondsToToggleDayTrading:
        pair.secondsToToggleIsDayTradingClosed >= 0 ? pair.secondsToToggleIsDayTradingClosed : null,
      schedule: pair.schedule
        ? {
            alwaysOpen: pair.schedule.alwaysOpen,
            timezone: pair.schedule.timezone,
            openingHours: pair.schedule.openingHours,
          }
        : undefined,
      checkedAt: at,
    },
  };
}

async function loadPairs(): Promise<PairsCache> {
  const client = await dataClient();
  const { pairs } = await wrapSdk(() => client.getPairs());
  const at = Date.now();
  const list = pairs.map((p) => toMarket(p, at)).sort((a, b) => Number(a.id) - Number(b.id));
  return { at, list, byId: new Map(list.map((m) => [m.id, m])) };
}

async function pairs(force = false): Promise<PairsCache> {
  if (!force && pairsCache && Date.now() - pairsCache.at < PAIRS_TTL_MS) return pairsCache;
  pairsInflight ??= loadPairs().finally(() => {
    pairsInflight = null;
  });
  pairsCache = await pairsInflight;
  return pairsCache;
}

async function getMarket(marketId: string, fresh = false): Promise<Market> {
  const market = (await pairs(fresh)).byId.get(marketId);
  if (!market) throw new VenueError("unknown-market", `Unknown Ostium market ${marketId}`);
  return market;
}

/** The guard every build method runs first: a fresh read, not the cache. */
async function assertOpen(marketId: string): Promise<Market> {
  const market = await getMarket(marketId, true);
  if (!market.hours.isOpen) {
    throw new VenueError("market-closed", `${market.symbol} is closed on Ostium right now`);
  }
  return market;
}

async function wrapSdk<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof VenueError) throw error;
    const message = error instanceof Error ? error.message : String(error);
    if (/no live price|price (is )?unavailable|market closed/i.test(message)) {
      throw new VenueError("no-price", message);
    }
    const code = error instanceof OstiumError ? ` (${error.code})` : "";
    throw new VenueError("sdk", `${message}${code}`);
  }
}

/* ---------- mapping ---------- */

function toUnsignedTx(built: BuiltTxRequest): UnsignedTx {
  if (built.kind !== "eoa") {
    throw new VenueError("sdk", "Expected a plain wallet transaction, got a Safe batch");
  }
  return {
    chainId: chainId(),
    to: built.to,
    data: built.data,
    value: built.value.toString(),
    from: built.from,
  };
}

function toPosition(p: SdkPosition, market: Market | undefined): Position {
  return {
    marketId: String(p.pairId),
    symbol: market?.symbol ?? `${p.pairFrom}/${p.pairTo}`,
    index: p.idx,
    side: p.side === "B" ? "long" : "short",
    sizeUsd: num(p.ntl),
    collateralUsd: num(p.collateralUsed),
    leverage: num(p.leverage),
    entryPrice: num(p.entryPx),
    liquidationPrice: num(p.liquidationPx),
    unrealizedPnlUsd: num(p.unrealizedPnl),
    takeProfit: p.tpPx && num(p.tpPx) > 0 ? num(p.tpPx) : undefined,
    stopLoss: p.slPx && num(p.slPx) > 0 ? num(p.slPx) : undefined,
    openedAt: p.openTimestamp,
    isDayTrade: p.isDayTrade,
  };
}

function tickToPrice(tick: PriceTick, byId: Map<string, Market>): Price | null {
  const market = tick.pairId ? byId.get(String(tick.pairId)) : undefined;
  if (!market) return null;
  return {
    marketId: market.id,
    symbol: market.symbol,
    bid: tick.bid,
    mid: tick.mid,
    ask: tick.ask,
    isOpen: tick.isMarketOpen,
    at: tick.timestampSeconds * 1000,
  };
}

function sdkOrderType(type: OpenIntent["orderType"]): SdkOrderType {
  switch (type) {
    case "limit":
      return SdkOrderType.Limit;
    case "stop":
      return SdkOrderType.Stop;
    default:
      return SdkOrderType.Market;
  }
}

/* ---------- Venue ---------- */

async function markets(): Promise<Market[]> {
  return (await pairs()).list;
}

async function prices(marketIds?: string[]): Promise<Price[]> {
  const [client, cache] = await Promise.all([dataClient(), pairs()]);
  const { prices: all } = await wrapSdk(() => client.getAllPrices());
  const at = Date.now();
  const wanted = marketIds ? new Set(marketIds) : null;
  const out: Price[] = [];
  for (const market of cache.list) {
    if (wanted && !wanted.has(market.id)) continue;
    const p = all[market.id];
    if (!p) continue;
    out.push({
      marketId: market.id,
      symbol: market.symbol,
      bid: num(p.bid),
      mid: num(p.mid),
      ask: num(p.ask),
      isOpen: market.hours.isOpen,
      at,
    });
  }
  return out;
}

function subscribePrices(marketIds: string[], onPrice: (price: Price) => void): () => void {
  let stopped = false;
  let stop: (() => void) | null = null;

  void (async () => {
    // Pairs first so the stream can resolve pair ids; the SDK's own cache
    // fills from the same getPairs call.
    const [client, cache] = await Promise.all([dataClient(), pairs()]);
    if (stopped) return;
    const stream = client.streamPrices(marketIds);
    const offTick = stream.onTick((tick) => {
      const price = tickToPrice(tick, cache.byId);
      if (price) onPrice(price);
    });
    const offSnapshot = stream.onSnapshot((ticks) => {
      for (const tick of ticks) {
        const price = tickToPrice(tick, cache.byId);
        if (price) onPrice(price);
      }
    });
    stream.onError(() => {
      // The stream reconnects on its own; nothing to do but keep going.
    });
    stop = () => {
      offTick();
      offSnapshot();
      stream.close();
    };
    if (stopped) stop();
  })().catch(() => {
    // A failed connect leaves the page on its last prices; the SSE route
    // reports the gap in its own status line.
  });

  return () => {
    stopped = true;
    stop?.();
  };
}

async function candles(
  marketId: string,
  resolution: CandleResolution,
  fromMs: number,
  toMs?: number,
): Promise<Candle[]> {
  const client = await dataClient();
  const rows = await wrapSdk(() => client.getCandles({ pairId: marketId, from: fromMs, to: toMs, resolution }));
  return rows.map((c) => ({ time: c.time, open: c.open, high: c.high, low: c.low, close: c.close }));
}

async function positions(trader: Hex): Promise<Position[]> {
  const [client, cache] = await Promise.all([traderClient(), pairs()]);
  const { pairPositions } = await wrapSdk(() => client.getOpenPositions({ user: trader }));
  return pairPositions.map(({ position }) => toPosition(position, cache.byId.get(String(position.pairId))));
}

async function previewOpen(intent: OpenIntent): Promise<PreviewResult> {
  const market = await getMarket(intent.marketId);
  if (!market.hours.isOpen) {
    throw new VenueError("market-closed", `${market.symbol} is closed on Ostium right now`);
  }
  const client = await dataClient();
  const isLong = intent.side === "long";
  const [preview, maxCollateral] = await wrapSdk(() =>
    Promise.all([
      client.previewOpenTrade({
        pairId: intent.marketId,
        isLong,
        collateral: intent.collateralUsd,
        leverage: intent.leverage,
        limitPrice: intent.orderType === "market" ? undefined : intent.limitPrice,
        isDayTrade: intent.isDayTrade,
        builderFeeBps: 0,
      }),
      client.getMaxCollateral({ pairId: intent.marketId, isLong, leverage: intent.leverage }),
    ]),
  );
  return {
    entryPrice: num(preview.entryPx),
    midPrice: num(preview.midPx),
    priceImpactPct: num(preview.priceImpactP),
    fees: {
      openUsd: num(preview.fees.openFee),
      oracleUsd: num(preview.fees.oracleFee),
      builderUsd: num(preview.fees.builderFee),
      totalUsd: num(preview.fees.total),
    },
    // `exposure` is the USD notional; `positionSize` is in base-asset units.
    sizeUsd: num(preview.exposure),
    liquidationPrice: num(preview.liquidationPx),
    effectiveMaxLeverage: num(preview.effectiveMaxLeverage),
    minSizeUsd: num(preview.minPositionSize),
    maxCollateralUsd: num(maxCollateral.max),
    maxCollateralBound: maxCollateral.bound,
    isValid: preview.isValid,
    warnings: preview.warnings.map((w) => ({ code: w.code, message: w.message })),
  };
}

async function currentMid(marketId: string): Promise<number> {
  const [price] = await prices([marketId]);
  if (!price || price.mid <= 0) throw new VenueError("no-price", `No live Ostium price for market ${marketId}`);
  return price.mid;
}

async function buildOpen(trader: Hex, intent: OpenIntent): Promise<UnsignedTx> {
  await assertOpen(intent.marketId);
  const price = intent.orderType === "market" ? await currentMid(intent.marketId) : intent.limitPrice;
  if (!price || price <= 0) throw new VenueError("sdk", "A limit or stop order needs a limit price");
  const client = await buildClient(trader);
  const built = await wrapSdk(async () =>
    client.getOpenTradeTx({
      pairId: intent.marketId,
      buy: intent.side === "long",
      price: toDec(price),
      collateral: toDec(intent.collateralUsd, 6),
      leverage: toDec(intent.leverage, 2),
      type: sdkOrderType(intent.orderType),
      takeProfit: intent.takeProfit ? toDec(intent.takeProfit) : undefined,
      stopLoss: intent.stopLoss ? toDec(intent.stopLoss) : undefined,
      slippage: intent.slippageBps,
      isDayTrade: intent.isDayTrade,
      builder: builderConfig(),
    }),
  );
  return toUnsignedTx(built);
}

async function buildClose(trader: Hex, intent: CloseIntent): Promise<UnsignedTx> {
  await assertOpen(intent.marketId);
  const price = await currentMid(intent.marketId);
  const client = await buildClient(trader);
  const built = await wrapSdk(async () =>
    client.getCloseTradeTx({
      pairId: intent.marketId,
      idx: intent.index,
      price: toDec(price),
      closePercent: Math.min(100, Math.max(1, Math.round(intent.closePercent))),
    }),
  );
  return toUnsignedTx(built);
}

async function buildUpdate(trader: Hex, intent: UpdateIntent): Promise<UnsignedTx[]> {
  await assertOpen(intent.marketId);
  const client = await buildClient(trader);
  const out: UnsignedTx[] = [];
  // Ostium sets a position's take profit and stop loss in separate calls.
  if (intent.takeProfit !== undefined) {
    const takeProfit = toDec(intent.takeProfit ?? 0);
    const built = await wrapSdk(async () =>
      client.getModifyOrderTx({ pairId: intent.marketId, idx: intent.index, target: "position", takeProfit }),
    );
    out.push(toUnsignedTx(built));
  }
  if (intent.stopLoss !== undefined) {
    const stopLoss = toDec(intent.stopLoss ?? 0);
    const built = await wrapSdk(async () =>
      client.getModifyOrderTx({ pairId: intent.marketId, idx: intent.index, target: "position", stopLoss }),
    );
    out.push(toUnsignedTx(built));
  }
  if (intent.collateralDeltaUsd !== undefined && intent.collateralDeltaUsd !== 0) {
    const delta = intent.collateralDeltaUsd;
    const amount = delta > 0 ? `+${toDec(delta, 6)}` : toDec(delta, 6);
    const built = await wrapSdk(() =>
      client.getUpdateCollateralTx({ pairId: intent.marketId, idx: intent.index, amount }),
    );
    out.push(toUnsignedTx(built));
  }
  if (out.length === 0) throw new VenueError("sdk", "Nothing to update: give a take profit, stop loss or collateral change");
  return out;
}

export const ostium: Venue = {
  id: "ostium",
  markets,
  prices,
  subscribePrices,
  candles,
  positions,
  previewOpen,
  buildOpen,
  buildClose,
  buildUpdate,
};

/* ---------- Ostium-specific extras for the internal page ---------- */

export interface FillRow {
  marketId: string;
  symbol: string;
  action: string;
  type: string;
  side: Side;
  price: number;
  sizeUsd: number;
  collateralUsd: number;
  leverage: number;
  closedPnlUsd: number;
  fees: { opening: number; rollover: number; builder: number; oracle: number; priceImpact: number };
  hash: string;
  /** ms epoch. */
  at: number;
}

function toFillRow(f: Fill, byId: Map<string, Market>): FillRow {
  return {
    marketId: String(f.pairId),
    symbol: byId.get(String(f.pairId))?.symbol ?? `${f.pairFrom}/${f.pairTo}`,
    action: f.action,
    type: f.type,
    side: f.side === "B" ? "long" : "short",
    price: num(f.px),
    sizeUsd: num(f.ntl),
    collateralUsd: num(f.collateralUsed),
    leverage: num(f.leverage),
    closedPnlUsd: num(f.closedPnl),
    fees: {
      opening: num(f.fees?.opening),
      rollover: num(f.fees?.rollover),
      builder: num(f.fees?.builder),
      oracle: num(f.fees?.oracle),
      priceImpact: num(f.fees?.priceImpact),
    },
    hash: f.hash,
    at: f.timestamp > 1e12 ? f.timestamp : f.timestamp * 1000,
  };
}

export async function getFills(trader: Hex, limit = 50): Promise<FillRow[]> {
  const [client, cache] = await Promise.all([traderClient(), pairs()]);
  const fills = await wrapSdk(() => client.getFills({ user: trader, limit }));
  return fills.map((f) => toFillRow(f, cache.byId)).sort((a, b) => b.at - a.at);
}

export interface OrderStatus {
  hash: string;
  isPending: boolean;
  isCancelled: boolean;
  cancelReason?: string;
  action?: string;
  price?: number;
}

export async function findOrdersByTxHash(hash: Hex): Promise<OrderStatus[]> {
  const client = await traderClient();
  const orders: Order[] = await wrapSdk(() => client.getOrders({ initiatedTxHashes: [hash] }));
  return orders.map((o) => ({
    hash,
    isPending: o.isPending,
    isCancelled: o.isCancelled,
    cancelReason: o.cancelReason,
    action: o.action,
    price: num(o.px) || undefined,
  }));
}

export interface RolloverPoint {
  /** ms epoch. */
  at: number;
  rate8hLong: number;
  rate8hShort: number;
}

/**
 * Rollover history reads contract events over the RPC, so it is slow and is
 * only fetched on demand for a short window.
 */
export async function getRolloverHistory(
  marketId: string,
  fromMs: number,
  toMs: number = Date.now(),
  intervalMs = 60 * 60 * 1000,
): Promise<RolloverPoint[]> {
  const client = await dataClient();
  const points = await wrapSdk(() =>
    client.getRolloverHistory({ pairId: marketId, from: fromMs, to: toMs, intervalMs }),
  );
  return points.map((p) => ({
    at: p.timestamp > 1e12 ? p.timestamp : p.timestamp * 1000,
    rate8hLong: num(p.rate8h?.long),
    rate8hShort: num(p.rate8h?.short),
  }));
}

export async function getApproveUsdcTx(trader: Hex, amountUsd: number | "max"): Promise<UnsignedTx> {
  const client = await buildClient(trader);
  const built = await wrapSdk(async () =>
    client.getApproveUsdcTx(amountUsd === "max" ? "max" : toDec(amountUsd, 6)),
  );
  return toUnsignedTx(built);
}

export interface WalletBalances {
  usdc: number;
  eth: number;
  allowanceUsdc: number;
}

export async function getBalances(trader: Hex): Promise<WalletBalances> {
  const client = await traderClient();
  const b = await wrapSdk(() => client.getBalances(trader));
  return { usdc: num(b.usdc), eth: num(b.eth), allowanceUsdc: num(b.allowance) };
}

let changesCache: { at: number; byId: Map<string, number> } | null = null;
const CHANGES_TTL_MS = 60_000;

/** 24-hour change in percent per market id, from the venue's price history; empty on failure. */
export async function getPriceChanges24h(): Promise<Map<string, number>> {
  if (changesCache && Date.now() - changesCache.at < CHANGES_TTL_MS) return changesCache.byId;
  try {
    const client = await dataClient();
    const rows = await client.getPriceChanges24h();
    const byId = new Map(rows.map((r) => [String(r.pairId), r.changePct]));
    changesCache = { at: Date.now(), byId };
    return byId;
  } catch {
    return changesCache?.byId ?? new Map();
  }
}
