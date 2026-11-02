import type { Hex } from "viem";

import type { PriceComparison } from "@/lib/chainlink/compare";
import type { LiveLink, LiveOrder, LiveStore, WalletSession } from "@/lib/live/store";
import { planEntry, riskInputFor, utcDate } from "@/lib/paper/engine";
import type { CloseReason, LiveDeps, LiveStrategy, PaperPosition, PaperStore } from "@/lib/paper/store";
import { checkRisk, type RiskLimits } from "@/lib/risk/check";
import type { Signer } from "@/lib/signers/types";
import type { DelegatedVenue, DelegationStatus, FillRow, OrderStatus } from "@/lib/venues/ostium";
import type { Market, Position, Price } from "@/lib/venues/types";

/**
 * Live execution for the paper runner (Studio step 7). The runner decides;
 * this module checks risk once more, builds the trade through the user's
 * delegate, signs it with the wallet's session key and records what went
 * out before anything else. Fills come back from the venue later and are
 * reconciled on the next tick. Positions are never stored, only read from
 * the chain and matched to the order that opened them, so a strategy only
 * ever touches its own.
 */

export const PENDING_STALE_MS = 10 * 60 * 1000;
const DELEGATE_CHECK_MS = 5 * 60 * 1000;
const FILL_LAG_GRACE_MS = 60 * 60 * 1000;
const RECEIPT_WAIT_MS = 3_000;

/** What the executor needs from the venue for one wallet session. */
export interface SessionDeps {
  venue: DelegatedVenue;
  signer: Signer;
  positions(): Promise<Position[]>;
  fillsSince(fromMs: number): Promise<FillRow[]>;
  delegation(requiredUsd: number): Promise<DelegationStatus>;
  orderId(hash: Hex, action: "open" | "close"): Promise<string | null>;
  orderStatus(hash: Hex): Promise<OrderStatus[]>;
  destroyKey(): Promise<void>;
}

export interface ExecutorDeps {
  live: LiveStore;
  paper: Pick<PaperStore, "recordActivity">;
  sessionDepsFor(session: WalletSession): SessionDeps | Promise<SessionDeps>;
  reference?(symbol: string, mid: number): Promise<PriceComparison | null>;
  testnet: boolean;
  riskLimits?: Partial<RiskLimits>;
  /** Lets tests skip the receipt wait. */
  sleep?(ms: number): Promise<void>;
  say?(line: string): void;
}

const CLOSE_ACTIONS: Record<string, CloseReason> = {
  Close: "signal",
  StopLoss: "stop-loss",
  TakeProfit: "take-profit",
  Liquidation: "liquidation",
  CloseDayTrade: "stopped",
};

const fees = (f: FillRow) => f.fees.opening + f.fees.rollover + f.fees.builder + f.fees.oracle + f.fees.priceImpact;

export const livePositionId = (pid: string) => `live:${pid}`;
export const pidOf = (positionId: string) => (positionId.startsWith("live:") ? positionId.slice(5) : null);

/** A chain position as the runner sees it: real size, blank exits, because those fire on-chain. */
export function positionView(s: LiveStrategy, p: Position, order: LiveOrder, today: string): PaperPosition {
  return {
    id: livePositionId(p.pid ?? order.pid ?? ""),
    strategyId: s.id,
    ownerId: s.ownerId,
    marketId: p.marketId,
    symbol: p.symbol,
    entryPrice: p.entryPrice,
    notionalUsd: p.sizeUsd,
    collateralUsd: p.collateralUsd,
    leverage: p.leverage,
    liquidationPrice: 0,
    takeProfit: undefined,
    stopLoss: undefined,
    openFeeUsd: 0,
    oracleFeeUsd: 0,
    rolloverPerDayUsd: 0,
    rolloverUsd: 0,
    daysHeld: 0,
    rolloverThrough: today,
    entryCandleDate: order.candleDate ?? today,
    openedAt: p.openedAt || order.createdAt,
    closedAt: null,
  };
}

export function liveDeps(d: ExecutorDeps): LiveDeps & LiveControls {
  const sleep = d.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const say = d.say ?? (() => undefined);

  // Per-tick caches, keyed by the tick's `nowMs` so a new tick reads fresh.
  let cacheAt = -1;
  const sessions = new Map<string, WalletSession>();
  const sessionDeps = new Map<string, SessionDeps>();
  const positions = new Map<string, Position[]>();
  const fills = new Map<string, { fromMs: number; rows: FillRow[] }>();
  const delegation = new Map<string, DelegationStatus>();

  function fresh(nowMs: number) {
    if (cacheAt === nowMs) return;
    cacheAt = nowMs;
    sessions.clear();
    sessionDeps.clear();
    positions.clear();
    fills.clear();
    delegation.clear();
  }

  async function sessionOf(sessionId: string): Promise<WalletSession> {
    const hit = sessions.get(sessionId);
    if (hit) return hit;
    const w = await d.live.session(sessionId);
    if (!w) throw new Error(`Wallet session ${sessionId} is missing`);
    sessions.set(sessionId, w);
    return w;
  }

  async function depsOf(sessionId: string): Promise<SessionDeps> {
    const hit = sessionDeps.get(sessionId);
    if (hit) return hit;
    const w = await sessionOf(sessionId);
    const sd = await d.sessionDepsFor(w);
    sessionDeps.set(sessionId, sd);
    return sd;
  }

  async function chainPositions(sessionId: string, force = false): Promise<Position[]> {
    if (!force) {
      const hit = positions.get(sessionId);
      if (hit) return hit;
    }
    const rows = await (await depsOf(sessionId)).positions();
    positions.set(sessionId, rows);
    return rows;
  }

  async function fillsFrom(sessionId: string, fromMs: number): Promise<FillRow[]> {
    const hit = fills.get(sessionId);
    if (hit && hit.fromMs <= fromMs) return hit.rows.filter((f) => f.at >= fromMs - 1);
    const rows = await (await depsOf(sessionId)).fillsSince(fromMs);
    fills.set(sessionId, { fromMs, rows });
    return rows;
  }

  async function delegationOf(s: LiveStrategy, nowMs: number): Promise<DelegationStatus> {
    const hit = delegation.get(s.live.sessionId);
    if (hit) return hit;
    const st = await (await depsOf(s.live.sessionId)).delegation(s.spec.size.collateralUsd);
    delegation.set(s.live.sessionId, st);
    await d.live.setDelegateCheck(s.live.sessionId, nowMs, st.allowanceUsd);
    return st;
  }

  async function activity(s: LiveStrategy, row: Omit<Parameters<PaperStore["recordActivity"]>[0], "strategyId" | "ownerId" | "mode">) {
    await d.paper.recordActivity({ strategyId: s.id, ownerId: s.ownerId, mode: "live", ...row });
  }

  async function endPermission(s: LiveStrategy, reason: string, nowMs: number) {
    const w = await sessionOf(s.live.sessionId);
    await d.live.setSessionStatus(w.id, "permission-ended", ["pending", "active"], nowMs, reason);
    const links = await d.live.linksForSession(w.id);
    for (const l of links) {
      if (!["active", "paused", "closing"].includes(l.status)) continue;
      await d.live.setLinkStatus(l.strategyId, "permission-ended", ["active", "paused", "closing"], nowMs, reason);
      await d.paper.recordActivity({
        strategyId: l.strategyId,
        ownerId: l.ownerId,
        mode: "live",
        kind: "refusal",
        reason:
          reason === "expired"
            ? "Permission ended: the expiry you set has passed. Nothing more is sent until you go live again."
            : reason === "revoked"
              ? "Permission ended: the wallet's delegate is no longer this session. Nothing more is sent."
              : `Permission ended: ${reason}. Nothing more is sent.`,
        meta: { codes: ["permission-ended"], detail: reason },
        dedupeKey: `${l.strategyId}:permission-ended`,
        time: nowMs,
      });
    }
    s.live.status = "permission-ended";
    say(`${s.name}: permission ended (${reason})`);
  }

  async function endStrategy(s: LiveStrategy, reason: string, nowMs: number) {
    const moved = await d.live.setLinkStatus(s.id, "ended", ["active", "paused", "closing", "permission-ended"], nowMs, reason);
    if (!moved) return;
    await d.live.setStrategyLive(s.id, false);
    await activity(s, { kind: "skip", reason: `Live trading ended: ${reason}.`, meta: { codes: ["live-ended"] }, time: nowMs });
    const remaining = (await d.live.linksForSession(s.live.sessionId)).filter((l) => l.status !== "ended");
    if (remaining.length === 0) {
      const w = await sessionOf(s.live.sessionId);
      if (await d.live.setSessionStatus(w.id, "ended", ["pending", "active", "permission-ended"], nowMs, reason)) {
        await (await depsOf(w.id)).destroyKey();
      }
    }
    s.live.status = "ended";
  }

  async function failOrder(s: LiveStrategy, o: LiveOrder, error: string, nowMs: number, status: LiveOrder["status"] = "failed") {
    await d.live.updateOrder(o.id, { status, error, updatedAt: nowMs });
    await activity(s, {
      kind: "refusal",
      candleDate: o.candleDate,
      sizeUsd: o.collateralUsd && o.leverage ? o.collateralUsd * o.leverage : undefined,
      reason: `${o.kind === "open" ? "Open" : "Close"} order ${status}: ${error}`,
      meta: { codes: [`order-${status}`], orderId: o.id, hash: o.txHash },
      dedupeKey: `${o.id}:${status}`,
      time: nowMs,
    });
  }

  async function markClosed(s: LiveStrategy, open: LiveOrder, fill: FillRow | null, reason: CloseReason | "unknown", nowMs: number) {
    const closedAt = fill?.at ?? nowMs;
    await d.live.updateOrder(open.id, {
      closedAt,
      closeReason: reason,
      closePnlUsd: fill?.closedPnlUsd ?? 0,
      fillFeesUsd: (open.fillFeesUsd ?? 0) + (fill ? fees(fill) : 0),
      updatedAt: nowMs,
    });
    await activity(s, {
      kind: "close",
      positionId: livePositionId(open.pid ?? ""),
      price: fill?.price,
      sizeUsd: fill?.sizeUsd ?? (open.collateralUsd && open.leverage ? open.collateralUsd * open.leverage : undefined),
      feesUsd: fill ? fees(fill) : undefined,
      pnlUsd: fill?.closedPnlUsd,
      reason: reason === "unknown" ? "closed on-chain (no fill found yet)" : reason,
      meta: { pid: open.pid, hash: fill?.hash, action: fill?.action },
      dedupeKey: `${open.id}:closed`,
      time: closedAt,
    });
    const day = utcDate(closedAt);
    await d.live.upsertDailyResult(s.id, day, await d.live.closedPnlForDay(s.id, day));
    say(`${s.name}: ${s.symbol} closed ${reason}${fill ? ` at ${fill.price}, net ${fill.closedPnlUsd.toFixed(2)}` : ""}`);
  }

  async function settlePending(s: LiveStrategy, o: LiveOrder, nowMs: number) {
    const sd = await depsOf(s.live.sessionId);
    const age = nowMs - o.createdAt;
    if (!o.txHash) {
      if (age > PENDING_STALE_MS) await failOrder(s, o, "it was never sent", nowMs);
      return;
    }
    let oid = o.oid;
    if (!oid) {
      try {
        oid = (await sd.orderId(o.txHash, o.kind)) ?? undefined;
        if (oid) await d.live.updateOrder(o.id, { oid, updatedAt: nowMs });
      } catch (e) {
        await failOrder(s, o, e instanceof Error ? e.message : String(e), nowMs);
        return;
      }
    }
    const rows = await fillsFrom(s.live.sessionId, o.createdAt - 60_000);
    const fill = rows.find((f) =>
      oid
        ? f.oid === oid
        : f.marketId === o.marketId && f.at >= o.createdAt - 60_000 && (o.kind === "open" ? f.action === "Open" : f.pid === o.pid),
    );
    if (fill) {
      await d.live.updateOrder(o.id, {
        status: "filled",
        pid: fill.pid ?? o.pid,
        fillPrice: fill.price,
        fillFeesUsd: fees(fill),
        fillPnlUsd: fill.closedPnlUsd,
        updatedAt: nowMs,
      });
      if (o.kind === "open") {
        await activity(s, {
          kind: "fill",
          positionId: livePositionId(fill.pid ?? ""),
          candleDate: o.candleDate,
          price: fill.price,
          sizeUsd: fill.sizeUsd,
          feesUsd: fees(fill),
          reason: "filled",
          meta: { pid: fill.pid, oid: fill.oid, hash: fill.hash },
          dedupeKey: `${o.id}:filled`,
          time: fill.at,
        });
        say(`${s.name}: filled long ${s.symbol} at ${fill.price}, ${fill.sizeUsd} at ${fill.leverage}x`);
      } else if (o.pid) {
        const open = (await d.live.openOrders(s.id)).find((x) => x.pid === o.pid);
        if (open) await markClosed(s, open, fill, (o.reason as CloseReason) || "signal", nowMs);
      }
      return;
    }
    if (age < PENDING_STALE_MS) return;
    const statuses = await sd.orderStatus(o.txHash).catch(() => [] as OrderStatus[]);
    const cancelled = statuses.find((x) => x.isCancelled);
    if (cancelled) {
      await failOrder(s, o, cancelled.cancelReason ?? "the keeper cancelled it", nowMs, "cancelled");
      return;
    }
    if (age > FILL_LAG_GRACE_MS && !statuses.some((x) => x.isPending)) await failOrder(s, o, "no fill after an hour", nowMs);
  }

  async function reconcileVanished(s: LiveStrategy, nowMs: number) {
    const onChain = new Set((await chainPositions(s.live.sessionId)).map((p) => p.pid).filter(Boolean));
    const pendingCloses = new Set((await d.live.pendingOrders(s.id)).filter((o) => o.kind === "close").map((o) => o.pid));
    for (const open of await d.live.openOrders(s.id)) {
      if (!open.pid || onChain.has(open.pid) || pendingCloses.has(open.pid)) continue;
      const rows = await fillsFrom(s.live.sessionId, open.createdAt);
      const fill = rows.find((f) => f.pid === open.pid && f.action in CLOSE_ACTIONS);
      if (fill) await markClosed(s, open, fill, CLOSE_ACTIONS[fill.action], nowMs);
      else if (nowMs - open.updatedAt > FILL_LAG_GRACE_MS) await markClosed(s, open, null, "unknown", nowMs);
    }
  }

  async function strategyOpenInMarket(s: LiveStrategy, pos: Position[]): Promise<{ own: Position[]; walletUsd: number }> {
    const ownPids = new Set((await d.live.openOrders(s.id)).map((o) => o.pid));
    const inMarket = pos.filter((p) => p.marketId === s.marketId && p.side === "long");
    return { own: inMarket.filter((p) => p.pid && ownPids.has(p.pid)), walletUsd: inMarket.reduce((a, p) => a + p.sizeUsd, 0) };
  }

  const controls: LiveControls = {
    async closeAll(strategyId, nowMs) {
      const s = (await d.live.liveStrategies()).find((x) => x.id === strategyId);
      if (!s) return { submitted: 0, skipped: ["Not live."] };
      fresh(nowMs);
      const today = utcDate(nowMs);
      const views = await api.openPositions(s);
      let submitted = 0;
      const skipped: string[] = [];
      for (const v of views) {
        try {
          if (await api.close(s, v, "stopped", nowMs)) submitted++;
          else skipped.push(`${v.symbol}: already closing`);
        } catch (e) {
          skipped.push(`${v.symbol}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
      void today;
      return { submitted, skipped };
    },
    async finishIfFlat(s, nowMs) {
      if (s.live.status !== "closing") return false;
      const open = await d.live.openOrders(s.id);
      const pending = await d.live.pendingOrders(s.id);
      if (open.length > 0 || pending.length > 0) return false;
      await endStrategy(s, "stopped", nowMs);
      return true;
    },
    endStrategy,
  };

  const api: LiveDeps = {
    strategies: () => d.live.liveStrategies(),

    async reconcile(s, nowMs) {
      fresh(nowMs);
      for (const o of await d.live.pendingOrders(s.id)) await settlePending(s, o, nowMs);
      await reconcileVanished(s, nowMs);
      await controls.finishIfFlat(s, nowMs);
    },

    async openPositions(s) {
      const today = utcDate(cacheAt > 0 ? cacheAt : Date.now());
      const pos = await chainPositions(s.live.sessionId);
      const byPid = new Map(pos.filter((p) => p.pid).map((p) => [p.pid as string, p]));
      const out: PaperPosition[] = [];
      for (const o of await d.live.openOrders(s.id)) {
        const p = o.pid ? byPid.get(o.pid) : undefined;
        if (p) out.push(positionView(s, p, o, today));
      }
      return out;
    },

    async gate(s, nowMs) {
      if (s.live.status === "paused") return "paused by you; no new entries until you resume";
      if (s.live.status === "closing") return "closing; no new entries";
      if (s.live.status !== "active") return `live status is ${s.live.status}`;
      if (s.live.expiresAt !== null && nowMs >= s.live.expiresAt) {
        await endPermission(s, "expired", nowMs);
        return "permission expired";
      }
      const w = await sessionOf(s.live.sessionId);
      let st = delegation.get(w.id);
      if (!st && (w.lastDelegateCheck === null || nowMs - w.lastDelegateCheck >= DELEGATE_CHECK_MS)) st = await delegationOf(s, nowMs);
      if (st && !st.delegateMatches) {
        await endPermission(s, "revoked", nowMs);
        return "permission ended: the wallet's delegate changed";
      }
      const allowance = st?.allowanceUsd ?? w.allowanceUsd;
      if (allowance < s.spec.size.collateralUsd) {
        return `approval too low: $${allowance.toFixed(2)} approved, $${s.spec.size.collateralUsd.toFixed(2)} needed; top up in MetaMask`;
      }
      return null;
    },

    async lossForDay(s, day) {
      const r = await d.live.closedPnlForDay(s.id, day);
      return r.pnlUsd < 0 ? -r.pnlUsd : 0;
    },

    async availableCollateral(s) {
      const st = await delegationOf(s, cacheAt > 0 ? cacheAt : Date.now());
      return Math.max(0, Math.min(st.allowanceUsd, st.usdcUsd, s.live.totalCapUsd - s.live.spentUsd));
    },

    async open(s, price, market, candleDate, nowMs) {
      fresh(nowMs);
      const { collateralUsd, leverage } = s.spec.size;
      const order = await d.live.createOrder({
        strategyId: s.id,
        sessionId: s.live.sessionId,
        ownerId: s.ownerId,
        kind: "open",
        ref: candleDate,
        marketId: s.marketId,
        symbol: s.symbol,
        candleDate,
        collateralUsd,
        leverage,
        reason: "signal",
        createdAt: nowMs,
      });
      if (!order) {
        say(`${s.name}: an open for ${candleDate} already exists`);
        return false;
      }
      const pos = await chainPositions(s.live.sessionId, true);
      const { own, walletUsd } = await strategyOpenInMarket(s, pos);
      if (own.length > 0) {
        await failOrder(s, order, "the strategy already has a position in this market", nowMs);
        return false;
      }
      const otherPending = (await d.live.pendingOrders(s.id)).filter((o) => o.id !== order.id && o.kind === "open" && nowMs - o.createdAt < PENDING_STALE_MS);
      if (otherPending.length > 0) {
        await failOrder(s, order, "an earlier open is still waiting for its fill", nowMs);
        return false;
      }
      // The checker runs again here, with the wallet's exposure in this market, right before anything is built.
      const loss = await api.lossForDay(s, candleDate);
      const reference = d.reference ? await d.reference(s.symbol, price.mid).catch(() => null) : null;
      const input = riskInputFor(s, market, price, loss, reference, d.testnet, d.riskLimits);
      const risk = checkRisk({ ...input, walletOpenInMarketUsd: walletUsd, strategy: { ...input.strategy, openNotionalUsd: own.reduce((a, p) => a + p.sizeUsd, 0) } });
      if (!risk.ok) {
        await d.live.updateOrder(order.id, { status: "failed", error: risk.refusals.map((f) => f.code).join(","), updatedAt: nowMs });
        await activity(s, {
          kind: "refusal",
          candleDate,
          price: price.mid,
          sizeUsd: collateralUsd * leverage,
          reason: risk.refusals.map((f) => f.message).join(" "),
          meta: { codes: risk.refusals.map((f) => f.code) },
          dedupeKey: `${s.id}:${candleDate}:refusal`,
          time: nowMs,
        });
        say(`${s.name}: refused, ${risk.refusals.map((f) => f.message).join(" ")}`);
        return false;
      }
      const plan = planEntry(s, price.ask, market, candleDate, nowMs);
      const sd = await depsOf(s.live.sessionId);
      const w = await sessionOf(s.live.sessionId);
      let hash: Hex;
      try {
        const tx = await sd.venue.buildOpen(w.trader, {
          marketId: s.marketId,
          side: "long",
          collateralUsd,
          leverage,
          orderType: "market",
          takeProfit: plan.takeProfit,
          stopLoss: plan.stopLoss,
        });
        await d.live.updateOrder(order.id, { takeProfit: plan.takeProfit, stopLoss: plan.stopLoss, updatedAt: nowMs } as never);
        hash = (await sd.signer.send(tx)).hash;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (isNotDelegate(e)) {
          await d.live.updateOrder(order.id, { status: "failed", error: msg, updatedAt: nowMs });
          await endPermission(s, "revoked", nowMs);
          return false;
        }
        await failOrder(s, order, msg, nowMs);
        return false;
      }
      await d.live.updateOrder(order.id, { status: "submitted", txHash: hash, updatedAt: nowMs });
      await d.live.addSpent(s.id, collateralUsd);
      await activity(s, {
        kind: "fill",
        candleDate,
        price: price.ask,
        sizeUsd: collateralUsd * leverage,
        reason: "submitted, waiting for the keeper",
        meta: { hash, takeProfit: plan.takeProfit, stopLoss: plan.stopLoss },
        dedupeKey: `${order.id}:submitted`,
        time: nowMs,
      });
      say(`${s.name}: sent open for ${s.symbol}, ${collateralUsd * leverage} at ${leverage}x, tx ${hash}`);
      await sleep(RECEIPT_WAIT_MS);
      try {
        const oid = await sd.orderId(hash, "open");
        if (oid) await d.live.updateOrder(order.id, { oid, updatedAt: nowMs });
      } catch (e) {
        await failOrder(s, { ...order, txHash: hash }, e instanceof Error ? e.message : String(e), nowMs);
        return false;
      }
      return true;
    },

    async close(s, pos, reason, nowMs, candleDate) {
      fresh(nowMs);
      const pid = pidOf(pos.id);
      if (!pid) return false;
      const order = await d.live.createOrder({
        strategyId: s.id,
        sessionId: s.live.sessionId,
        ownerId: s.ownerId,
        kind: "close",
        ref: pid,
        marketId: pos.marketId,
        symbol: pos.symbol,
        candleDate,
        pid,
        reason,
        createdAt: nowMs,
      });
      if (!order) return false;
      const onChain = (await chainPositions(s.live.sessionId, true)).find((p) => p.pid === pid);
      if (!onChain) {
        await d.live.updateOrder(order.id, { status: "failed", error: "already closed on-chain", updatedAt: nowMs });
        return false;
      }
      const sd = await depsOf(s.live.sessionId);
      const w = await sessionOf(s.live.sessionId);
      let hash: Hex;
      try {
        const tx = await sd.venue.buildClose(w.trader, { marketId: pos.marketId, index: onChain.index, closePercent: 100 });
        hash = (await sd.signer.send(tx)).hash;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (isNotDelegate(e)) {
          await d.live.updateOrder(order.id, { status: "failed", error: msg, updatedAt: nowMs });
          await endPermission(s, "revoked", nowMs);
          return false;
        }
        await failOrder(s, order, msg, nowMs);
        return false;
      }
      await d.live.updateOrder(order.id, { status: "submitted", txHash: hash, positionIndex: onChain.index, updatedAt: nowMs });
      await activity(s, {
        kind: "close",
        positionId: pos.id,
        candleDate,
        price: pos.entryPrice,
        sizeUsd: pos.notionalUsd,
        reason: `${reason}: close sent, waiting for the keeper`,
        meta: { hash, pid },
        dedupeKey: `${order.id}:submitted`,
        time: nowMs,
      });
      say(`${s.name}: sent close for ${pos.symbol} (${reason}), tx ${hash}`);
      await sleep(RECEIPT_WAIT_MS);
      try {
        const oid = await sd.orderId(hash, "close");
        if (oid) await d.live.updateOrder(order.id, { oid, updatedAt: nowMs });
      } catch (e) {
        await failOrder(s, { ...order, txHash: hash }, e instanceof Error ? e.message : String(e), nowMs);
        return false;
      }
      return true;
    },
  };

  return { ...api, ...controls };
}

export interface LiveControls {
  /** Close every position the strategy owns; works while paused. */
  closeAll(strategyId: string, nowMs: number): Promise<{ submitted: number; skipped: string[] }>;
  /** A closing strategy with nothing left on-chain ends; true when it did. */
  finishIfFlat(s: LiveStrategy, nowMs: number): Promise<boolean>;
  endStrategy(s: LiveStrategy, reason: string, nowMs: number): Promise<void>;
}

/** Matches the trading contract's revert for a sender that is no longer the delegate. */
export function isNotDelegate(e: unknown): boolean {
  const msg = e instanceof Error ? `${e.message} ${(e as { cause?: { message?: string } }).cause?.message ?? ""}` : String(e);
  return /NotDelegate|not the delegate|NoDelegate|DelegateForbidden/i.test(msg);
}

export type { LiveLink };
