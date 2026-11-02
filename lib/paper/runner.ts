import { candleDateOf, closeNumbers, DAY_MS, decideExit, isDue, planEntry, riskFor, rolloverDue, signalOn, unrealised, utcDate } from "@/lib/paper/engine";
import { MIN_COLLATERAL_USD } from "@/lib/strategies/backtest";
import { isLive, type CloseReason, type PaperPosition, type PaperStrategy, type TickDeps, type TickReport } from "@/lib/paper/store";
import type { Market, Price } from "@/lib/venues/types";

/**
 * One paper tick (Studio step 5): exits first for every open position at
 * the live bid, then the daily decision for every paper strategy whose
 * last completed candle has not been run. Each decision is claimed by
 * (strategy, candle date), so a retry never trades twice; closed markets
 * log one skip per candle date and are tried again at the next tick.
 *
 * Live strategies (step 7) go through the same decisions; their opens and
 * closes are handed to `deps.live`, which checks risk again, builds the
 * trade through the user's delegate and signs with the wallet's session
 * key. Their positions are chain reads with blank exits, so the only closes
 * this runner asks for are signal and stop.
 */

const STALE_MS = 10 * 60 * 1000;
export { STALE_MS };

interface Ctx {
  deps: TickDeps;
  now: number;
  today: string;
  prices: Map<string, Price>;
  positions: Map<string, PaperPosition>;
  report: TickReport;
}

function say(ctx: Ctx, line: string) {
  ctx.report.lines.push(line);
}

const modeOf = (s: PaperStrategy): "paper" | "live" => (isLive(s) ? "live" : "paper");

async function closeAt(ctx: Ctx, pos: PaperPosition, exitPrice: number, reason: CloseReason, candleDate?: string, s?: PaperStrategy) {
  const { store } = ctx.deps;
  if (s && isLive(s) && ctx.deps.live) {
    const sent = await ctx.deps.live.close(s, pos, reason, ctx.now, candleDate);
    if (sent) {
      ctx.positions.delete(pos.strategyId);
      ctx.report.exits++;
    }
    return sent;
  }
  let p = pos;
  const due = rolloverDue(pos, ctx.today);
  if (due.days > 0 && (await store.accrueRollover(pos.id, due.from, due.to, due.days, due.chargeUsd))) {
    p = { ...pos, rolloverUsd: pos.rolloverUsd + due.chargeUsd, daysHeld: pos.daysHeld + due.days, rolloverThrough: due.to };
  }
  const n = closeNumbers(p, exitPrice, reason);
  const closed = await store.closePosition(pos.id, { closedAt: ctx.now, reason, exitPrice, ...n });
  if (!closed) return false;
  await store.recordActivity({
    strategyId: pos.strategyId,
    ownerId: pos.ownerId,
    mode: "paper",
    kind: "close",
    positionId: pos.id,
    candleDate,
    price: exitPrice,
    sizeUsd: pos.notionalUsd,
    feesUsd: n.feesUsd,
    pnlUsd: n.realisedPnlUsd,
    reason,
    dedupeKey: `${pos.id}:close`,
    time: ctx.now,
  });
  await store.upsertDailyResult(pos.strategyId, ctx.today);
  ctx.positions.delete(pos.strategyId);
  ctx.report.exits++;
  say(ctx, `${pos.symbol}: closed ${reason} at ${exitPrice}, net ${n.realisedPnlUsd.toFixed(2)}`);
  return true;
}

async function skip(ctx: Ctx, s: PaperStrategy, candleDate: string, reason: string) {
  await ctx.deps.store.recordActivity({
    strategyId: s.id,
    ownerId: s.ownerId,
    mode: modeOf(s),
    kind: "skip",
    candleDate,
    reason,
    dedupeKey: `${s.id}:${candleDate}:skip`,
    time: ctx.now,
  });
  ctx.report.skips++;
  say(ctx, `${s.name}: skipped, ${reason}`);
}

export async function runTick(deps: TickDeps, now = Date.now()): Promise<TickReport> {
  const report: TickReport = { at: now, positionsChecked: 0, exits: 0, runs: 0, entries: 0, refusals: 0, skips: 0, errors: [], lines: [] };
  const ctx: Ctx = { deps, now, today: utcDate(now), prices: new Map(), positions: new Map(), report };
  const { store } = deps;

  const strategies: PaperStrategy[] = await store.paperStrategies();
  const open = await store.openPositions();
  if (deps.live) {
    for (const s of await deps.live.strategies()) {
      strategies.push(s);
      try {
        await deps.live.reconcile(s, now);
        if (s.live.status === "ended" || s.live.status === "permission-ended") continue;
        open.push(...(await deps.live.openPositions(s)));
      } catch (e) {
        report.errors.push(`${s.name} live: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }
  const byId = new Map(strategies.map((s) => [s.id, s]));
  for (const p of open) ctx.positions.set(p.strategyId, p);

  const marketIds = Array.from(new Set([...strategies.map((s) => s.marketId), ...open.map((p) => p.marketId)]));
  if (marketIds.length === 0) return report;
  let markets = new Map<string, Market>();
  try {
    markets = new Map((await deps.markets()).map((m) => [m.id, m]));
  } catch (e) {
    report.errors.push(`markets: ${e instanceof Error ? e.message : String(e)}`);
  }
  try {
    for (const p of await deps.prices.prices(marketIds)) ctx.prices.set(p.marketId, p);
  } catch (e) {
    report.errors.push(`prices: ${e instanceof Error ? e.message : String(e)}`);
  }

  // A. Exits between checks.
  for (const pos of open) {
    report.positionsChecked++;
    const price = ctx.prices.get(pos.marketId);
    if (!price || !price.isOpen || price.bid <= 0) continue;
    const s = byId.get(pos.strategyId);
    const stopping = !s || (isLive(s) ? s.live.status === "closing" : s.status !== "paper");
    const reason = decideExit(pos, price.bid, stopping);
    if (!reason) continue;
    try {
      await closeAt(ctx, pos, price.bid, reason, undefined, s);
    } catch (e) {
      report.errors.push(`${pos.symbol} close: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // B. Daily decisions, grouped by market.
  const groups = new Map<string, PaperStrategy[]>();
  for (const s of strategies) {
    if (isLive(s)) {
      if (s.live.status !== "active" && s.live.status !== "paused") continue;
    } else if (s.status !== "paper") continue;
    groups.set(s.marketId, [...(groups.get(s.marketId) ?? []), s]);
  }
  for (const [marketId, group] of groups) {
    const ids = group.map((s) => s.id);
    const expected = utcDate(now - DAY_MS);
    const doneExpected = await store.finishedRuns(ids, expected);
    if (ids.every((id) => doneExpected.has(id))) continue;

    let candles;
    try {
      candles = await deps.candles(marketId, now);
    } catch (e) {
      report.errors.push(`candles ${marketId}: ${e instanceof Error ? e.message : String(e)}`);
      continue;
    }
    const cd = candleDateOf(candles);
    if (!cd) {
      for (const s of group) await skip(ctx, s, ctx.today, "no daily candles from the venue yet");
      continue;
    }
    const market = markets.get(marketId);
    const price = ctx.prices.get(marketId);
    const done = await store.finishedRuns(ids, cd.date);

    for (const s of group) {
      if (!isDue(cd.closeMs, s.paperSince) || done.has(s.id)) continue;
      if (!market) {
        await skip(ctx, s, cd.date, `market ${marketId} is no longer listed`);
        continue;
      }
      if (!price) {
        await skip(ctx, s, cd.date, `no live price for ${s.symbol}; will check on the next tick`);
        continue;
      }
      if (!price.isOpen) {
        await skip(ctx, s, cd.date, `${s.symbol} is closed; will check at the next open`);
        continue;
      }
      if (isLive(s) && deps.live) {
        // Not claimed, so a resume later today still acts on this candle.
        const why = await deps.live.gate(s, now).catch((e) => `live check failed: ${e instanceof Error ? e.message : String(e)}`);
        if (why) {
          await skip(ctx, s, cd.date, why);
          continue;
        }
      }
      if (!(await store.claimRun(s.id, cd.date, now))) continue;
      report.runs++;
      try {
        let pos = ctx.positions.get(s.id) ?? null;
        if (pos && !isLive(s)) {
          const due = rolloverDue(pos, ctx.today);
          if (due.days > 0 && (await store.accrueRollover(pos.id, due.from, due.to, due.days, due.chargeUsd))) {
            pos = { ...pos, rolloverUsd: pos.rolloverUsd + due.chargeUsd, daysHeld: pos.daysHeld + due.days, rolloverThrough: due.to };
            ctx.positions.set(s.id, pos);
          }
        }
        // Blown out: the strategy's equity (its collateral plus what it has made or lost on paper) is under the venue's minimum.
        // Live positions are liquidated by the chain, so the check is paper-only.
        const realised = isLive(s) ? 0 : await store.realisedSince(s.id, s.paperSince ?? 0);
        const equity = isLive(s) ? Number.POSITIVE_INFINITY : s.spec.size.collateralUsd + realised + (pos ? unrealised(pos, price.mid) : 0);
        if (equity < MIN_COLLATERAL_USD) {
          if (pos) await closeAt(ctx, pos, price.bid, "blown-out", cd.date);
          await store.markBlownOut(s.id, now);
          await store.recordActivity({
            strategyId: s.id,
            ownerId: s.ownerId,
            mode: "paper",
            kind: "refusal",
            candleDate: cd.date,
            price: price.mid,
            reason: `Blown out: equity of $${equity.toFixed(2)} is below Ostium's $${MIN_COLLATERAL_USD} minimum collateral. Paper trading stopped.`,
            meta: { codes: ["blown-out"] },
            dedupeKey: `${s.id}:blown-out`,
            time: now,
          });
          await store.finishRun(s.id, cd.date, "refused", "blown-out");
          report.refusals++;
          say(ctx, `${s.name}: blown out at $${equity.toFixed(2)} equity`);
          continue;
        }

        const sig = signalOn(s.spec.entry, candles);
        if (sig) {
          await store.recordActivity({
            strategyId: s.id,
            ownerId: s.ownerId,
            mode: modeOf(s),
            kind: "signal",
            candleDate: cd.date,
            price: price.mid,
            sizeUsd: s.spec.size.collateralUsd * s.spec.size.leverage,
            reason: sig,
            dedupeKey: `${s.id}:${cd.date}:signal`,
            time: now,
          });
        }
        let outcome: "hold" | "entered" | "exited" | "refused" = "hold";
        let note: string | undefined;
        if (sig === "exit" && pos) {
          if (await closeAt(ctx, pos, price.bid, "signal", cd.date, s)) outcome = "exited";
        } else if (sig === "enter" && !pos) {
          const live = isLive(s) && deps.live ? deps.live : null;
          const loss = live ? await live.lossForDay(s as never, cd.date) : await store.lossForDay(s.id, cd.date);
          const reference = deps.reference ? await deps.reference(s.symbol, price.mid).catch(() => null) : null;
          const risk = riskFor(s, market, price, loss, reference, deps.testnet, deps.riskLimits);
          const notional = s.spec.size.collateralUsd * s.spec.size.leverage;
          let refusal: { reason: string; codes: string[] } | null = null;
          if (!risk.ok) refusal = { reason: risk.refusals.map((f) => f.message).join(" "), codes: risk.refusals.map((f) => f.code) };
          else if (live && isLive(s)) {
            const available = await live.availableCollateral(s);
            if (s.spec.size.collateralUsd > available) {
              refusal = {
                reason: `Approved USDC of $${available.toFixed(2)} cannot cover $${s.spec.size.collateralUsd.toFixed(2)} of collateral; top up the approval in MetaMask.`,
                codes: ["approval"],
              };
            }
          } else {
            const available = await store.availableCollateral(s.ownerId);
            if (s.spec.size.collateralUsd > available) {
              refusal = { reason: `Paper balance of $${available.toFixed(2)} cannot cover $${s.spec.size.collateralUsd.toFixed(2)} of collateral.`, codes: ["paper-balance"] };
            }
          }
          if (refusal) {
            await store.recordActivity({
              strategyId: s.id,
              ownerId: s.ownerId,
              mode: modeOf(s),
              kind: "refusal",
              candleDate: cd.date,
              price: price.mid,
              sizeUsd: notional,
              reason: refusal.reason,
              meta: { codes: refusal.codes },
              dedupeKey: `${s.id}:${cd.date}:refusal`,
              time: now,
            });
            outcome = "refused";
            note = refusal.codes.join(",");
            report.refusals++;
            say(ctx, `${s.name}: refused, ${refusal.reason}`);
          } else if (live && isLive(s)) {
            if (await live.open(s, price, market, cd.date, now)) {
              outcome = "entered";
              report.entries++;
            } else {
              outcome = "refused";
              note = "live-open";
              report.refusals++;
            }
          } else {
            const opened = await store.openPosition(planEntry(s, price.ask, market, cd.date, now));
            if (opened) {
              ctx.positions.set(s.id, opened);
              await store.recordActivity({
                strategyId: s.id,
                ownerId: s.ownerId,
                mode: "paper",
                kind: "fill",
                positionId: opened.id,
                candleDate: cd.date,
                price: opened.entryPrice,
                sizeUsd: opened.notionalUsd,
                feesUsd: opened.openFeeUsd + opened.oracleFeeUsd,
                reason: "open",
                dedupeKey: `${opened.id}:open`,
                time: now,
              });
              outcome = "entered";
              report.entries++;
              say(ctx, `${s.name}: long ${s.symbol} at ${opened.entryPrice}, ${opened.notionalUsd} at ${opened.leverage}x`);
            }
          }
        } else {
          say(ctx, `${s.name}: ${sig ? `${sig} signal, ` : ""}hold on ${cd.date}`);
        }
        await store.finishRun(s.id, cd.date, outcome, note);
      } catch (e) {
        report.errors.push(`${s.name}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }
  return report;
}

/** Stop: close the strategy's open position at the live bid when there is one. */
export async function closeForStop(deps: TickDeps, strategyId: string, now = Date.now()): Promise<{ closed: boolean; note: string }> {
  const pos = (await deps.store.openPositions()).find((p) => p.strategyId === strategyId);
  if (!pos) return { closed: false, note: "No open paper position." };
  const [price] = await deps.prices.prices([pos.marketId]).catch(() => [] as Price[]);
  if (!price || !price.isOpen || price.bid <= 0) return { closed: false, note: `${pos.symbol} is closed; the position closes when it reopens.` };
  const report: TickReport = { at: now, positionsChecked: 1, exits: 0, runs: 0, entries: 0, refusals: 0, skips: 0, errors: [], lines: [] };
  const ctx: Ctx = { deps, now, today: utcDate(now), prices: new Map([[pos.marketId, price]]), positions: new Map([[strategyId, pos]]), report };
  const closed = await closeAt(ctx, pos, price.bid, "stopped");
  return { closed, note: closed ? `Closed ${pos.symbol} at ${price.bid}.` : "The position was already closed." };
}
