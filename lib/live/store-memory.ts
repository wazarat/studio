import type { Hex } from "viem";

import type { LiveLink, LiveOrder, LiveStore, NewOrder, NewSession, OrderPatch, WalletSession } from "@/lib/live/store";
import type { LiveStrategy, PaperStrategy } from "@/lib/paper/store";

/**
 * In-memory LiveStore for tests (step 7), with the Neon store's guards:
 * status changes are compare-and-set, an order wins once per
 * (strategy, kind, ref). Rows come back as copies.
 */
export class MemoryLiveStore implements LiveStore {
  sessions = new Map<string, WalletSession>();
  links = new Map<string, LiveLink>();
  orders: LiveOrder[] = [];
  /** The strategies table, as the paper store sees it. */
  strategies = new Map<string, PaperStrategy>();
  daily = new Map<string, { pnlUsd: number; feesUsd: number; trades: number }>();
  private seq = 0;

  constructor(strategies: PaperStrategy[] = []) {
    for (const s of strategies) this.strategies.set(s.id, s);
  }

  async liveStrategies(): Promise<LiveStrategy[]> {
    const out: LiveStrategy[] = [];
    for (const l of this.links.values()) {
      if (!["active", "paused", "closing"].includes(l.status)) continue;
      const s = this.strategies.get(l.strategyId);
      const w = this.sessions.get(l.sessionId);
      if (!s || !w) continue;
      out.push({
        ...s,
        live: {
          sessionId: w.id,
          trader: w.trader,
          sessionAddress: w.sessionAddress,
          status: l.status,
          expiresAt: w.expiresAt,
          totalCapUsd: l.totalCapUsd,
          spentUsd: l.spentUsd,
        },
      });
    }
    return out;
  }

  async session(id: string) {
    const w = this.sessions.get(id);
    return w ? { ...w } : null;
  }

  async sessionForWallet(ownerId: string, trader: Hex) {
    const w = Array.from(this.sessions.values()).find(
      (x) => x.ownerId === ownerId && x.trader.toLowerCase() === trader.toLowerCase() && x.status !== "ended",
    );
    return w ? { ...w } : null;
  }

  async createSession(s: NewSession, nowMs: number) {
    const w: WalletSession = {
      id: s.id ?? `ws-${++this.seq}`,
      ownerId: s.ownerId,
      trader: s.trader,
      sessionAddress: s.sessionAddress,
      kmsKeyId: s.kmsKeyId,
      status: "pending",
      expiresAt: s.expiresAt,
      lastDelegateCheck: null,
      allowanceUsd: 0,
      createdAt: nowMs,
      activatedAt: null,
      endedAt: null,
    };
    this.sessions.set(w.id, w);
    return { ...w };
  }

  async setSessionStatus(id: string, to: WalletSession["status"], from: WalletSession["status"][], nowMs: number, reason?: string) {
    const w = this.sessions.get(id);
    if (!w || !from.includes(w.status)) return false;
    w.status = to;
    if (to === "active" && w.activatedAt === null) w.activatedAt = nowMs;
    if (to === "ended" || to === "permission-ended") {
      w.endedAt = nowMs;
      w.endedReason = reason;
    }
    return true;
  }

  async setSessionTxs(id: string, txs: { approveTx?: string; delegateTx?: string; gasTopupTx?: string }) {
    const w = this.sessions.get(id);
    if (w) Object.assign(w, Object.fromEntries(Object.entries(txs).filter(([, v]) => v !== undefined)));
  }

  async setSessionExpiry(id: string, expiresAtMs: number | null) {
    const w = this.sessions.get(id);
    if (w) w.expiresAt = expiresAtMs;
  }

  async setDelegateCheck(id: string, atMs: number, allowanceUsd: number) {
    const w = this.sessions.get(id);
    if (w) {
      w.lastDelegateCheck = atMs;
      w.allowanceUsd = allowanceUsd;
    }
  }

  async link(strategyId: string) {
    const l = this.links.get(strategyId);
    return l ? { ...l } : null;
  }

  async linksForSession(sessionId: string) {
    return Array.from(this.links.values())
      .filter((l) => l.sessionId === sessionId)
      .map((l) => ({ ...l }));
  }

  async upsertLink(l: Pick<LiveLink, "strategyId" | "sessionId" | "ownerId" | "totalCapUsd">, nowMs: number) {
    this.links.set(l.strategyId, { ...l, status: "active", spentUsd: 0, startedAt: nowMs, endedAt: null, endedReason: undefined });
  }

  async setLinkStatus(strategyId: string, to: LiveLink["status"], from: LiveLink["status"][], nowMs: number, reason?: string) {
    const l = this.links.get(strategyId);
    if (!l || !from.includes(l.status)) return false;
    l.status = to;
    if (to === "ended" || to === "permission-ended") {
      l.endedAt = nowMs;
      l.endedReason = reason;
    }
    return true;
  }

  async setLinkCap(strategyId: string, totalCapUsd: number) {
    const l = this.links.get(strategyId);
    if (l) l.totalCapUsd = totalCapUsd;
  }

  async addSpent(strategyId: string, usd: number) {
    const l = this.links.get(strategyId);
    if (l) l.spentUsd += usd;
  }

  async setStrategyLive(strategyId: string, live: boolean) {
    const s = this.strategies.get(strategyId);
    if (!s) return;
    if (live) s.status = "live";
    else if (s.status === "live") s.status = "draft";
  }

  async createOrder(o: NewOrder) {
    if (this.orders.some((x) => x.strategyId === o.strategyId && x.kind === o.kind && x.ref === o.ref)) return null;
    const row: LiveOrder = { ...o, id: `lo-${++this.seq}`, status: "building", closedAt: null, updatedAt: o.createdAt };
    this.orders.push(row);
    return { ...row };
  }

  async updateOrder(id: string, patch: OrderPatch) {
    const row = this.orders.find((x) => x.id === id);
    if (!row) return;
    for (const [k, v] of Object.entries(patch)) if (v !== undefined) (row as unknown as Record<string, unknown>)[k] = v;
  }

  async order(strategyId: string, kind: LiveOrder["kind"], ref: string) {
    const row = this.orders.find((x) => x.strategyId === strategyId && x.kind === kind && x.ref === ref);
    return row ? { ...row } : null;
  }

  async pendingOrders(strategyId?: string) {
    return this.orders
      .filter((x) => (x.status === "building" || x.status === "submitted") && (!strategyId || x.strategyId === strategyId))
      .map((x) => ({ ...x }));
  }

  async openOrders(strategyId?: string) {
    return this.orders
      .filter((x) => x.kind === "open" && x.status === "filled" && !x.closedAt && (!strategyId || x.strategyId === strategyId))
      .map((x) => ({ ...x }));
  }

  async ordersForStrategy(strategyId: string, limit = 50) {
    return this.orders
      .filter((x) => x.strategyId === strategyId)
      .slice(-limit)
      .reverse()
      .map((x) => ({ ...x }));
  }

  async closedPnlForDay(strategyId: string, day: string) {
    const rows = this.orders.filter(
      (x) => x.strategyId === strategyId && x.kind === "open" && x.closedAt && new Date(x.closedAt).toISOString().slice(0, 10) === day,
    );
    return {
      pnlUsd: rows.reduce((a, x) => a + (x.closePnlUsd ?? 0), 0),
      feesUsd: rows.reduce((a, x) => a + (x.fillFeesUsd ?? 0), 0),
      trades: rows.length,
    };
  }

  async upsertDailyResult(strategyId: string, day: string, r: { pnlUsd: number; feesUsd: number; trades: number }) {
    this.daily.set(`${strategyId}:${day}`, { ...r });
  }
}
