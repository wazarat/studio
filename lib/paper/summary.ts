import "server-only";

import { unrealised } from "@/lib/paper/engine";
import { paperAccountFor, paperActivityFor, paperPositionsFor } from "@/lib/paper/store-neon";
import type { ActivityRow, PaperPosition } from "@/lib/paper/store";
import type { Price } from "@/lib/venues/types";

/**
 * Paper state for the pages (Studio step 5): the account strip and the
 * strategy page's position, history and feed.
 */
export interface OpenPositionView extends PaperPosition {
  markPrice: number | null;
  unrealisedUsd: number | null;
}

export interface PaperSummary {
  startingUsd: number;
  /** Cash: starting plus realised. */
  balanceUsd: number;
  /** Cash plus unrealised on open positions. */
  accountValueUsd: number;
  todayUsd: number;
  open: OpenPositionView[];
}

function mark(p: PaperPosition, prices: Map<string, Price>): OpenPositionView {
  const price = prices.get(p.marketId);
  const markPrice = price ? price.mid : null;
  return { ...p, markPrice, unrealisedUsd: markPrice ? unrealised(p, markPrice) : null };
}

export async function loadPaperSummary(ownerId: string, prices: Price[]): Promise<PaperSummary> {
  const byId = new Map(prices.map((p) => [p.marketId, p]));
  const [account, positions] = await Promise.all([paperAccountFor(ownerId), paperPositionsFor(ownerId)]);
  const open = positions.filter((p) => p.closedAt === null).map((p) => mark(p, byId));
  const unrealisedTotal = open.reduce((s, p) => s + (p.unrealisedUsd ?? 0), 0);
  const balanceUsd = account.startingUsd + account.realisedUsd;
  return {
    startingUsd: account.startingUsd,
    balanceUsd,
    accountValueUsd: balanceUsd + unrealisedTotal,
    todayUsd: account.realisedTodayUsd + unrealisedTotal,
    open,
  };
}

export interface PaperForStrategy {
  status: "draft" | "paper" | "live";
  since: number | null;
  open: PaperPosition | null;
  closed: PaperPosition[];
  activity: ActivityRow[];
  realisedSinceStartUsd: number;
}

export async function loadPaperForStrategy(ownerId: string, strategyId: string, status: PaperForStrategy["status"], since: number | null): Promise<PaperForStrategy> {
  const [positions, activity] = await Promise.all([paperPositionsFor(ownerId, strategyId), paperActivityFor(ownerId, strategyId, 50)]);
  const open = positions.find((p) => p.closedAt === null) ?? null;
  const closed = positions.filter((p) => p.closedAt !== null && (since === null || p.openedAt >= since));
  return {
    status,
    since,
    open,
    closed,
    activity,
    realisedSinceStartUsd: closed.reduce((s, p) => s + (p.realisedPnlUsd ?? 0), 0),
  };
}
