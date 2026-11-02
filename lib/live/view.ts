import "server-only";

import type { Hex } from "viem";

import { liveLinksForOwner, liveLinkWithSession, neonLiveStore } from "@/lib/live/store-neon";
import type { LiveOrder } from "@/lib/live/store";
import { lowApproval, remainingUsd, termsBounds, tradesText } from "@/lib/live/terms";
import { liveEnabled } from "@/lib/paper/tick";
import { paperActivityFor } from "@/lib/paper/store-neon";
import type { ActivityRow } from "@/lib/paper/store";
import type { StrategyRow } from "@/lib/strategies/db";
import { getDelegationStatus, ostium, tradingContracts } from "@/lib/venues/ostium";
import type { Position } from "@/lib/venues/types";

/**
 * Everything the Go-live card shows for one strategy (step 7), read fresh
 * on the page and on every poll: the wallet session and this strategy's
 * link, the on-chain approval and delegate, the strategy's own positions,
 * its orders and its live feed rows. No key material anywhere.
 */
export interface LiveView {
  enabled: boolean;
  network: string;
  contracts: { trading: Hex; tradingStorage: Hex; usdc: Hex };
  terms: {
    collateralUsd: number;
    leverage: number;
    maxPositionUsd: number;
    dailyLossLimitUsd: number;
    minTotalUsd: number;
    maxTotalUsd: number;
    defaultTotalUsd: number;
    defaultExpiryMs: number;
    maxExpiryMs: number;
  };
  session: {
    id: string;
    trader: Hex;
    sessionAddress: Hex;
    status: "pending" | "active" | "permission-ended" | "ended";
    expiresAt: number | null;
    approveTx?: string;
    delegateTx?: string;
    gasTopupTx?: string;
    endedReason?: string;
  } | null;
  link: {
    status: "active" | "paused" | "closing" | "permission-ended" | "ended";
    totalCapUsd: number;
    spentUsd: number;
    remainingUsd: number;
    remainingText: string;
    low: boolean;
    startedAt: number;
    endedReason?: string;
  } | null;
  wallet: { allowanceUsd: number; usdcUsd: number; delegateMatches: boolean; currentDelegate?: Hex; sessionEth: number | null } | null;
  /** Other strategies trading through the same wallet. */
  siblings: Array<{ strategyId: string; status: string; totalCapUsd: number; spentUsd: number }>;
  positions: Array<Position & { pid: string }>;
  orders: LiveOrder[];
  activity: ActivityRow[];
}

export async function loadLiveView(row: StrategyRow): Promise<LiveView> {
  const now = Date.now();
  const bounds = termsBounds(row.spec.size.collateralUsd, now);
  const c = tradingContracts();
  const base: LiveView = {
    enabled: liveEnabled(),
    network: c.network,
    contracts: { trading: c.trading, tradingStorage: c.tradingStorage, usdc: c.usdc },
    terms: {
      collateralUsd: row.spec.size.collateralUsd,
      leverage: row.spec.size.leverage,
      maxPositionUsd: row.spec.caps.maxPositionUsd,
      dailyLossLimitUsd: row.spec.caps.dailyLossLimitUsd,
      ...bounds,
    },
    session: null,
    link: null,
    wallet: null,
    siblings: [],
    positions: [],
    orders: [],
    activity: [],
  };
  const found = await liveLinkWithSession(row.id);
  if (!found) return base;
  const { link, session } = found;
  const [status, chain, orders, activity, all] = await Promise.all([
    getDelegationStatus(session.trader, session.sessionAddress, row.spec.size.collateralUsd).catch(() => null),
    ostium.positions(session.trader).catch(() => [] as Position[]),
    neonLiveStore.ordersForStrategy(row.id, 20),
    paperActivityFor(row.ownerId, row.id, 60),
    liveLinksForOwner(row.ownerId),
  ]);
  const allowance = status?.allowanceUsd ?? session.allowanceUsd;
  const remaining = remainingUsd(link.totalCapUsd, link.spentUsd, allowance);
  const ownPids = new Set((await neonLiveStore.openOrders(row.id)).map((o) => o.pid));
  return {
    ...base,
    session: {
      id: session.id,
      trader: session.trader,
      sessionAddress: session.sessionAddress,
      status: session.status,
      expiresAt: session.expiresAt,
      approveTx: session.approveTx,
      delegateTx: session.delegateTx,
      gasTopupTx: session.gasTopupTx,
      endedReason: session.endedReason,
    },
    link: {
      status: link.status,
      totalCapUsd: link.totalCapUsd,
      spentUsd: link.spentUsd,
      remainingUsd: remaining,
      remainingText: tradesText(remaining, row.spec.size.collateralUsd),
      low: lowApproval(remaining, row.spec.size.collateralUsd),
      startedAt: link.startedAt,
      endedReason: link.endedReason,
    },
    wallet: status
      ? { allowanceUsd: status.allowanceUsd, usdcUsd: status.usdcUsd, delegateMatches: status.delegateMatches, currentDelegate: status.currentDelegate, sessionEth: null }
      : null,
    siblings: all
      .filter((x) => x.session.id === session.id && x.link.strategyId !== row.id)
      .map((x) => ({ strategyId: x.link.strategyId, status: x.link.status, totalCapUsd: x.link.totalCapUsd, spentUsd: x.link.spentUsd })),
    positions: chain.filter((p): p is Position & { pid: string } => !!p.pid && ownPids.has(p.pid)),
    orders,
    activity: activity.filter((a) => a.mode === "live"),
  };
}
