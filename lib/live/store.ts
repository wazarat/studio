import type { Hex } from "viem";

import type { LiveStrategy } from "@/lib/paper/store";

/**
 * Storage for live trading (Studio step 7). One wallet session per owner
 * and trader wallet holds the session account whose key lives in AWS KMS;
 * a live link per strategy carries that strategy's share of the approval;
 * every transaction the session sent is an order row, so retries can see
 * what already went out and fills can be attributed to the strategy that
 * opened them. As with the paper store, every write is a single guarded
 * statement: there are no transactions, so the guards say whether they won.
 */

export type SessionStatus = "pending" | "active" | "permission-ended" | "ended";
export type LiveStatus = "active" | "paused" | "closing" | "permission-ended" | "ended";
export type OrderKind = "open" | "close";
export type LiveOrderStatus = "building" | "submitted" | "filled" | "cancelled" | "failed";

export interface WalletSession {
  id: string;
  ownerId: string;
  trader: Hex;
  sessionAddress: Hex;
  kmsKeyId: string;
  status: SessionStatus;
  /** ms epoch; null when the user has not set one yet. */
  expiresAt: number | null;
  approveTx?: string;
  delegateTx?: string;
  gasTopupTx?: string;
  /** ms epoch of the last on-chain delegate and allowance read. */
  lastDelegateCheck: number | null;
  /** USDC allowance to TradingStorage at the last read. */
  allowanceUsd: number;
  createdAt: number;
  activatedAt: number | null;
  endedAt: number | null;
  endedReason?: string;
}

export interface NewSession {
  /** Chosen before the KMS key is created, so the key's alias can carry it. */
  id?: string;
  ownerId: string;
  trader: Hex;
  sessionAddress: Hex;
  kmsKeyId: string;
  expiresAt: number | null;
}

export interface LiveLink {
  strategyId: string;
  sessionId: string;
  ownerId: string;
  status: LiveStatus;
  /** This strategy's share of the wallet's approval, USD. */
  totalCapUsd: number;
  /** Collateral this strategy has committed since it went live, USD. */
  spentUsd: number;
  startedAt: number;
  endedAt: number | null;
  endedReason?: string;
}

export interface LiveOrder {
  id: string;
  strategyId: string;
  sessionId: string;
  ownerId: string;
  kind: OrderKind;
  /** Candle date for an open, the position id for a close. */
  ref: string;
  marketId: string;
  symbol: string;
  candleDate?: string;
  collateralUsd?: number;
  leverage?: number;
  takeProfit?: number;
  stopLoss?: number;
  txHash?: Hex;
  /** Ostium's order id from the receipt; the keeper's fill carries the same one. */
  oid?: string;
  /** Position id once filled (open) or the position being closed (close). */
  pid?: string;
  positionIndex?: number;
  status: LiveOrderStatus;
  fillPrice?: number;
  fillPnlUsd?: number;
  fillFeesUsd?: number;
  /** Set on an open order when its position left the chain. */
  closedAt?: number | null;
  closeReason?: string;
  closePnlUsd?: number;
  error?: string;
  /** Why this order was sent, in the runner's words. */
  reason?: string;
  createdAt: number;
  updatedAt: number;
}

export type NewOrder = Pick<LiveOrder, "strategyId" | "sessionId" | "ownerId" | "kind" | "ref" | "marketId" | "symbol"> &
  Partial<Pick<LiveOrder, "candleDate" | "collateralUsd" | "leverage" | "takeProfit" | "stopLoss" | "pid" | "positionIndex" | "reason">> & {
    createdAt: number;
  };

export type OrderPatch = Partial<
  Pick<
    LiveOrder,
    "txHash" | "oid" | "pid" | "positionIndex" | "status" | "fillPrice" | "fillPnlUsd" | "fillFeesUsd" | "closedAt" | "closeReason" | "closePnlUsd" | "error"
  >
> & { updatedAt: number };

export interface LiveStore {
  /** Strategies with a link in active, paused or closing, joined with their session. */
  liveStrategies(): Promise<LiveStrategy[]>;
  session(id: string): Promise<WalletSession | null>;
  /** The wallet's session that is not ended, if any. */
  sessionForWallet(ownerId: string, trader: Hex): Promise<WalletSession | null>;
  createSession(s: NewSession, nowMs: number): Promise<WalletSession>;
  /** Compare-and-set; false when the session was not in one of `from`. */
  setSessionStatus(id: string, to: SessionStatus, from: SessionStatus[], nowMs: number, reason?: string): Promise<boolean>;
  setSessionTxs(id: string, txs: { approveTx?: string; delegateTx?: string; gasTopupTx?: string }): Promise<void>;
  setSessionExpiry(id: string, expiresAtMs: number | null): Promise<void>;
  setDelegateCheck(id: string, atMs: number, allowanceUsd: number): Promise<void>;

  link(strategyId: string): Promise<LiveLink | null>;
  linksForSession(sessionId: string): Promise<LiveLink[]>;
  /** Creates or restarts the link as active with a fresh cap and zero spent. */
  upsertLink(link: Pick<LiveLink, "strategyId" | "sessionId" | "ownerId" | "totalCapUsd">, nowMs: number): Promise<void>;
  setLinkStatus(strategyId: string, to: LiveStatus, from: LiveStatus[], nowMs: number, reason?: string): Promise<boolean>;
  setLinkCap(strategyId: string, totalCapUsd: number): Promise<void>;
  addSpent(strategyId: string, usd: number): Promise<void>;
  /** The strategies table: 'live' while linked, 'draft' once ended. */
  setStrategyLive(strategyId: string, live: boolean): Promise<void>;

  /** Null when an order with the same (strategy, kind, ref) exists. */
  createOrder(o: NewOrder): Promise<LiveOrder | null>;
  updateOrder(id: string, patch: OrderPatch): Promise<void>;
  order(strategyId: string, kind: OrderKind, ref: string): Promise<LiveOrder | null>;
  /** Orders still building or submitted, for one strategy or all. */
  pendingOrders(strategyId?: string): Promise<LiveOrder[]>;
  /** Filled open orders whose position is still on-chain as far as we know. */
  openOrders(strategyId?: string): Promise<LiveOrder[]>;
  ordersForStrategy(strategyId: string, limit?: number): Promise<LiveOrder[]>;
  /** Realised PnL of this strategy's positions closed on that UTC day, from reconciled open orders. */
  closedPnlForDay(strategyId: string, day: string): Promise<{ pnlUsd: number; feesUsd: number; trades: number }>;
  upsertDailyResult(strategyId: string, day: string, r: { pnlUsd: number; feesUsd: number; trades: number }): Promise<void>;
}
