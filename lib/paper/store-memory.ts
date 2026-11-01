import type {
  ActivityRow,
  CloseFields,
  NewActivity,
  NewPosition,
  PaperPosition,
  PaperStore,
  PaperStrategy,
  RunOutcome,
} from "@/lib/paper/store";
import { STALE_MS } from "@/lib/paper/runner";

/**
 * In-memory PaperStore for tests, with the same guard semantics as the
 * Neon store: a claim wins once per candle date unless stale, one open
 * position per strategy, a close wins once, rollover is compare-and-set,
 * activity dedupes on its key. The balance is derived, never stored.
 */
export class MemoryPaperStore implements PaperStore {
  strategies = new Map<string, PaperStrategy>();
  positions = new Map<string, PaperPosition>();
  runs = new Map<string, { startedAt: number; finishedAt: number | null; outcome?: RunOutcome; note?: string }>();
  activity: ActivityRow[] = [];
  startingBalance = new Map<string, number>();
  private seq = 0;

  constructor(strategies: PaperStrategy[] = []) {
    for (const s of strategies) this.strategies.set(s.id, s);
  }

  async paperStrategies() {
    const withOpen = new Set(Array.from(this.positions.values()).filter((p) => p.closedAt === null).map((p) => p.strategyId));
    return Array.from(this.strategies.values()).filter((s) => s.status === "paper" || withOpen.has(s.id));
  }

  /** Copies, as rows from a database would be. */
  async openPositions() {
    return Array.from(this.positions.values())
      .filter((p) => p.closedAt === null)
      .map((p) => ({ ...p }));
  }

  async finishedRuns(ids: string[], candleDate: string) {
    return new Set(ids.filter((id) => this.runs.get(`${id}:${candleDate}`)?.finishedAt));
  }

  async claimRun(id: string, candleDate: string, nowMs: number) {
    const key = `${id}:${candleDate}`;
    const r = this.runs.get(key);
    if (!r) {
      this.runs.set(key, { startedAt: nowMs, finishedAt: null });
      return true;
    }
    if (r.finishedAt === null && nowMs - r.startedAt >= STALE_MS) {
      r.startedAt = nowMs;
      return true;
    }
    return false;
  }

  async finishRun(id: string, candleDate: string, outcome: RunOutcome, note?: string) {
    const r = this.runs.get(`${id}:${candleDate}`);
    if (r) Object.assign(r, { finishedAt: Date.now(), outcome, note });
  }

  async openPosition(p: NewPosition) {
    if (Array.from(this.positions.values()).some((x) => x.strategyId === p.strategyId && x.closedAt === null)) return null;
    const pos: PaperPosition = { ...p, id: `pos-${++this.seq}`, closedAt: null };
    this.positions.set(pos.id, pos);
    return { ...pos };
  }

  async accrueRollover(id: string, from: string, to: string, days: number, chargeUsd: number) {
    const p = this.positions.get(id);
    if (!p || p.closedAt !== null || p.rolloverThrough !== from) return false;
    p.rolloverUsd += chargeUsd;
    p.daysHeld += days;
    p.rolloverThrough = to;
    return true;
  }

  async closePosition(id: string, c: CloseFields) {
    const p = this.positions.get(id);
    if (!p || p.closedAt !== null) return null;
    Object.assign(p, { closedAt: c.closedAt, closeReason: c.reason, exitPrice: c.exitPrice, pricePnlUsd: c.pricePnlUsd, feesUsd: c.feesUsd, realisedPnlUsd: c.realisedPnlUsd });
    return { ...p };
  }

  async recordActivity(row: NewActivity) {
    if (row.dedupeKey && this.activity.some((a) => a.strategyId === row.strategyId && a.dedupeKey === row.dedupeKey)) return;
    this.activity.push({ ...row, id: `act-${++this.seq}` });
  }

  async lossForDay(strategyId: string, day: string) {
    const pnl = Array.from(this.positions.values())
      .filter((p) => p.strategyId === strategyId && p.closedAt !== null && new Date(p.closedAt).toISOString().slice(0, 10) === day)
      .reduce((s, p) => s + (p.realisedPnlUsd ?? 0), 0);
    return pnl < 0 ? -pnl : 0;
  }

  async upsertDailyResult() {
    // Derived from positions on read in this store.
  }

  async realisedSince(strategyId: string, sinceMs: number) {
    return Array.from(this.positions.values())
      .filter((p) => p.strategyId === strategyId && p.closedAt !== null && p.openedAt >= sinceMs)
      .reduce((s, p) => s + (p.realisedPnlUsd ?? 0), 0);
  }

  async markBlownOut(strategyId: string, nowMs: number) {
    const s = this.strategies.get(strategyId);
    if (s) this.strategies.set(strategyId, { ...s, status: "draft", blownOutAt: nowMs });
  }

  async availableCollateral(ownerId: string) {
    const starting = this.startingBalance.get(ownerId) ?? 10_000;
    const mine = Array.from(this.positions.values()).filter((p) => p.ownerId === ownerId);
    const realised = mine.filter((p) => p.closedAt !== null).reduce((s, p) => s + (p.realisedPnlUsd ?? 0), 0);
    const open = mine.filter((p) => p.closedAt === null).reduce((s, p) => s + p.collateralUsd, 0);
    return starting + realised - open;
  }
}
