"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState, useTransition } from "react";

import { candlesAction, listProposalsAction, marketsAction, paperStateAction, saveStrategyAction, setPaperStatusAction } from "@/app/(app)/studio/strategies/actions";
import { ConnectCard, type ConnectionView } from "@/components/studio/ConnectCard";
import { ProposalCard } from "@/components/studio/ProposalCard";
import { serverAlias, serverPath } from "@/lib/mcp/connect";
import type { Proposal } from "@/lib/proposals/types";
import { PriceChart } from "@/components/charts/dynamic";
import { MarketsRail } from "@/components/studio/MarketsRail";
import { RulePanel } from "@/components/studio/RulePanel";
import { ResultsTabs } from "@/components/studio/ResultsTabs";
import { useDebouncedValue } from "@/components/studio/useDebouncedValue";
import { useLivePrices } from "@/components/studio/useLivePrices";
import { useMarketNames } from "@/components/studio/useMarketNames";
import { PERP_NOTE, marketLabel, marketShort, type MarketNames } from "@/lib/venues/names";
import { inputClasses } from "@/components/ui/Input";
import { paperMarkersFor } from "@/lib/paper/activity";
import { unrealised } from "@/lib/paper/engine";
import type { PaperForStrategy } from "@/lib/paper/summary";
import { checkRisk, LIMITED_BELOW_USD, type RiskFinding } from "@/lib/risk/check";
import { BacktestError, runBacktest, tradeCosts, type BacktestResult } from "@/lib/strategies/backtest";
import { markersFor, overlaysFor, paneFor } from "@/lib/strategies/chart-data";
import { draftReducer, generatedName, leverageCap, toSpec, type Draft } from "@/lib/strategies/draft";
import { LIQUIDATION_LOSS_FRACTION, StrategySpecSchema, type StrategySpec } from "@/lib/strategies/spec";
import { cn } from "@/lib/utils";
import { formatAgo, formatPrice, formatUsd } from "@/lib/venues/format";
import type { Candle, Market, Price } from "@/lib/venues/types";

/**
 * The strategy workspace (Studio step 4b): markets on the left, the chart
 * in the middle with the rule drawn and the backtest's trades marked, the
 * strategy panel on the right, results below. Every change re-runs the
 * pure engine in the browser after a short debounce; Save asks the server
 * to run the same engine and store the result.
 */
export interface WorkspaceProps {
  markets: Market[];
  prices: Price[];
  changes: Record<string, number>;
  initialDraft: Draft;
  initialCandles: Candle[] | null;
  savedSpec: StrategySpec | null;
  initialPaper: PaperForStrategy | null;
  initialNames: MarketNames;
  initialProposals: Proposal[];
  initialConnections: ConnectionView[];
  baseUrl: string;
  savedBacktest: BacktestResult | null;
}

const DAY_MS = 86_400_000;

export function Workspace(props: WorkspaceProps) {
  const router = useRouter();
  const [markets, setMarkets] = useState(props.markets);
  const [changes, setChanges] = useState(props.changes);
  const [draft, dispatch] = useReducer(draftReducer, props.initialDraft);
  const [savedSpec, setSavedSpec] = useState<StrategySpec | null>(props.savedSpec);
  const [paper, setPaper] = useState<PaperForStrategy | null>(props.initialPaper);
  const [proposals, setProposals] = useState<Proposal[]>(props.initialProposals);
  const [paperNote, setPaperNote] = useState<string | null>(null);
  const [toggling, startToggle] = useTransition();
  const live = useLivePrices(props.prices, true);
  const [names, setNames] = useMarketNames(props.initialNames);
  const now = useNow();

  const marketsById = useMemo(() => new Map(markets.map((m) => [m.id, m])), [markets]);
  const baseMarket = marketsById.get(draft.marketId) ?? markets[0];
  const livePrice = live.prices[baseMarket.id];
  const market = useMemo<Market>(
    () => ({ ...baseMarket, hours: { ...baseMarket.hours, isOpen: livePrice?.isOpen ?? baseMarket.hours.isOpen } }),
    [baseMarket, livePrice?.isOpen],
  );
  const cap = useMemo(() => leverageCap(market, draft.tier), [market, draft.tier]);
  const name = draft.nameTouched ? draft.name : generatedName(market.symbol, draft.entry);

  // Candles per market, fetched once and kept for the session.
  const cache = useRef(new Map<string, Candle[]>());
  if (props.initialCandles && !cache.current.has(props.initialDraft.marketId)) cache.current.set(props.initialDraft.marketId, props.initialCandles);
  const [candles, setCandles] = useState<Candle[] | null>(props.initialCandles);
  const [candleError, setCandleError] = useState<string | null>(null);
  useEffect(() => {
    const id = draft.marketId;
    const hit = cache.current.get(id);
    if (hit) {
      setCandles(hit);
      setCandleError(null);
      return;
    }
    setCandles(null);
    setCandleError(null);
    let stale = false;
    candlesAction(id).then((res) => {
      if (stale) return;
      if (res.ok) {
        cache.current.set(id, res.candles);
        setCandles(res.candles);
      } else setCandleError(res.error);
    });
    return () => {
      stale = true;
    };
  }, [draft.marketId]);

  // Limits, open interest and 24h change refresh every five minutes.
  useEffect(() => {
    const t = setInterval(async () => {
      const res = await marketsAction();
      if (res.ok) {
        setMarkets(res.markets);
        setChanges(res.changes);
      }
    }, 5 * 60 * 1000);
    return () => clearInterval(t);
  }, []);

  // Spec, validation, risk and costs: instant.
  const spec = useMemo(() => toSpec(draft, market, name), [draft, market, name]);
  const parsed = useMemo(() => StrategySpecSchema.safeParse(spec), [spec]);
  const issues = useMemo(() => {
    const out: Record<string, string> = {};
    if (!parsed.success) for (const i of parsed.error.issues) out[i.path.join(".")] ??= i.message;
    return out;
  }, [parsed]);
  const notional = draft.size.collateralUsd * draft.size.leverage;
  const risk = useMemo(
    () =>
      parsed.success
        ? checkRisk({
            kind: "open",
            tier: draft.tier,
            testnet: true,
            intent: { marketId: market.id, side: "long", collateralUsd: draft.size.collateralUsd, leverage: draft.size.leverage, orderType: "market" },
            market,
            sizeUsd: notional,
            strategy: { strategyId: spec.id, openNotionalUsd: 0, dailyLossLimitUsd: draft.caps.dailyLossLimitUsd, lossTodayUsd: 0 },
            reference: null,
            limits: { maxPositionUsdPerStrategy: draft.caps.maxPositionUsd },
          })
        : null,
    [parsed.success, draft, market, notional, spec.id],
  );
  const costs = useMemo(() => tradeCosts(notional, market), [notional, market]);
  const mid = livePrice?.mid ?? candles?.[candles.length - 1]?.close ?? null;
  const liquidationPrice = mid ? mid * (1 - LIQUIDATION_LOSS_FRACTION / draft.size.leverage) : null;

  // The backtest: debounced, in the browser.
  const validSpec = parsed.success ? parsed.data : null;
  const debouncedSpec = useDebouncedValue(validSpec, 300);
  const run = useMemo<{ result: BacktestResult | null; error: string | null }>(() => {
    if (!candles || !debouncedSpec) return { result: null, error: null };
    try {
      return { result: runBacktest({ spec: debouncedSpec, candles, market, testnet: true }), error: null };
    } catch (e) {
      return { result: null, error: e instanceof BacktestError ? e.message : String(e) };
    }
  }, [candles, debouncedSpec, market]);
  const overlays = useMemo(() => (candles && debouncedSpec ? overlaysFor(debouncedSpec.entry, candles) : []), [candles, debouncedSpec]);
  const pane = useMemo(() => (candles && debouncedSpec ? paneFor(debouncedSpec.entry, candles) : null), [candles, debouncedSpec]);
  const lastCandleTime = candles?.[candles.length - 1]?.time ?? null;
  const markers = useMemo(() => {
    const paperPositions = paper ? [...(paper.open ? [paper.open] : []), ...paper.closed] : [];
    return [...markersFor(run.result), ...paperMarkersFor(paperPositions, lastCandleTime)].sort((a, b) => a.time - b.time);
  }, [run.result, paper, lastCandleTime]);
  const priceLines = useMemo(() => {
    const p = paper?.open;
    if (!p) return [];
    const lines: { price: number; title: string; color: "signal" | "rose" | "muted" }[] = [
      { price: p.entryPrice, title: "paper entry", color: "signal" },
      { price: p.liquidationPrice, title: "liquidation", color: "rose" },
    ];
    if (p.takeProfit) lines.push({ price: p.takeProfit, title: "take profit", color: "muted" });
    if (p.stopLoss) lines.push({ price: p.stopLoss, title: "stop loss", color: "muted" });
    return lines;
  }, [paper?.open]);

  // Pending proposals refresh while the strategy is saved.
  useEffect(() => {
    if (!draft.id) return;
    const id = draft.id;
    const t = setInterval(async () => {
      const res = await listProposalsAction(id);
      if (res.ok) setProposals(res.proposals);
    }, 30_000);
    return () => clearInterval(t);
  }, [draft.id]);

  // Paper state refresh while on paper.
  useEffect(() => {
    if (!draft.id || paper?.status !== "paper") return;
    const id = draft.id;
    const t = setInterval(async () => {
      const res = await paperStateAction(id);
      if (res.ok) setPaper(res.paper);
    }, 60_000);
    return () => clearInterval(t);
  }, [draft.id, paper?.status]);

  const togglePaper = useCallback(
    (status: "paper" | "draft") => {
      if (!draft.id) return;
      const id = draft.id;
      setPaperNote(null);
      startToggle(async () => {
        const res = await setPaperStatusAction(id, status);
        if (!res.ok) {
          setPaperNote(res.error);
          return;
        }
        setPaper(res.paper);
        setPaperNote(res.note);
        dispatch({ type: "status", status: res.paper.status });
        setSavedSpec((prev) => (prev ? { ...prev, status: res.paper.status } : prev));
        router.refresh();
      });
    },
    [draft.id, router],
  );

  // Paper since start versus what the backtest expected over the same days.
  const sinceLine = useMemo(() => {
    if (!paper || paper.status !== "paper" || !paper.since) return null;
    const openU = paper.open && mid ? unrealised(paper.open, mid) : 0;
    const net = paper.realisedSinceStartUsd + openU;
    let expected: number | null = null;
    if (run.result) {
      const eq = run.result.equity;
      const k0 = eq.findIndex((p) => p.time + DAY_MS > paper.since!);
      if (k0 >= 0 && eq.length > 0) expected = eq[eq.length - 1].equityUsd - (k0 > 0 ? eq[k0 - 1].equityUsd : draft.size.collateralUsd);
    }
    const s = (v: number) => `${v >= 0 ? "+" : "−"}${formatUsd(Math.abs(v))}`;
    return `Paper since ${new Date(paper.since).toISOString().slice(0, 10)}: ${s(paper.realisedSinceStartUsd)} realised, ${s(openU)} open, net ${s(net)}${expected === null ? "" : ` · the backtest expected ${s(expected)} over the same days`}`;
  }, [paper, mid, run.result, draft.size.collateralUsd]);

  const dirty = JSON.stringify({ ...spec, id: "" }) !== JSON.stringify(savedSpec ? { ...savedSpec, id: "" } : null);

  // Save.
  const [saving, startSave] = useTransition();
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveRefusals, setSaveRefusals] = useState<RiskFinding[]>([]);
  const [savedNote, setSavedNote] = useState<string | null>(null);
  const onSave = useCallback(() => {
    setSaveError(null);
    setSaveRefusals([]);
    const { id: _ignored, status: _s, ...raw } = spec;
    startSave(async () => {
      const res = await saveStrategyAction(raw, draft.id ?? undefined);
      if (!res.ok) {
        setSaveError(res.error);
        setSaveRefusals(res.refusals ?? []);
        return;
      }
      const stored: StrategySpec = { ...spec, id: res.id };
      setSavedSpec(stored);
      setSavedNote(res.warnings[0] ?? `Saved ${name}`);
      if (!draft.id) {
        dispatch({ type: "saved", id: res.id });
        window.history.replaceState(null, "", `/studio/strategies/${res.id}`);
      }
      router.refresh();
    });
  }, [spec, draft.id, name, router]);

  const change = changes[market.id];
  const open = market.hours.isOpen;
  const nextClose = Math.ceil(now / DAY_MS) * DAY_MS;

  return (
    <div className="grid grid-cols-1 border-t border-ink-700/40 lg:min-h-[calc(100vh-4rem)] lg:grid-cols-[15rem_minmax(0,1fr)_21rem]">
      <aside className="hidden border-r border-ink-700/40 lg:sticky lg:top-16 lg:block lg:h-[calc(100vh-4rem)]">
        <MarketsRail
          markets={markets}
          prices={live.prices}
          changes={changes}
          selectedId={market.id}
          onSelect={(id) => dispatch({ type: "market", marketId: id, leverageCap: leverageCap(marketsById.get(id) ?? market, draft.tier).cap })}
          names={names}
          onNames={setNames}
        />
      </aside>

      <section className="min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-700/40 px-4 py-3">
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <select
              value={market.id}
              onChange={(e) => dispatch({ type: "market", marketId: e.target.value, leverageCap: leverageCap(marketsById.get(e.target.value) ?? market, draft.tier).cap })}
              className={cn(inputClasses, "w-auto py-1 text-sm lg:hidden")}
              aria-label="Market"
            >
              {markets.map((m) => (
                <option key={m.id} value={m.id}>
                  {marketLabel(m, names).primary}
                </option>
              ))}
            </select>
            <h1 className="hidden font-display text-xl font-semibold text-ink-50 lg:block">
              {marketLabel(market, names).primary}
              {marketLabel(market, names).secondary ? <span className="ml-2 text-sm font-normal text-ink-400">{market.symbol}</span> : null}
            </h1>
            <span className="rounded-md border border-ink-700/60 bg-ink-800/50 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-ink-400" title={PERP_NOTE}>
              perp
            </span>
            <span className="text-lg tabular-nums text-ink-100">{mid ? formatPrice(mid) : "–"}</span>
            <span className={cn("text-xs tabular-nums", change === undefined ? "text-ink-500" : change < 0 ? "text-rose-400" : "text-ink-400")}>
              {change === undefined ? "" : `${change >= 0 ? "+" : "−"}${Math.abs(change).toFixed(2)}% today`}
            </span>
            <span className="text-xs text-ink-400">
              {open ? "Open" : "Closed"} · {market.category} · max {formatUsd(market.limits.maxSizeNowUsd, 0)} now
              {market.limits.maxSizeNowUsd < LIMITED_BELOW_USD ? (
                <span className="ml-1 rounded-md border border-ink-700/60 px-1 text-[9px] uppercase tracking-wide text-ink-400" title="Under $50 of room: the checker will refuse most sizes here">
                  limited
                </span>
              ) : null}
            </span>
          </div>
          <p className="text-[11px] text-ink-500">
            {live.state === "live" && live.lastTickAt ? `Live · ${formatAgo(live.lastTickAt, now)}` : live.state === "retrying" ? "Reconnecting" : "Connecting"} · next check at daily close, {formatCountdown(nextClose - now)}
          </p>
        </div>
        <p className="border-b border-ink-700/40 px-4 py-1.5 text-[11px] text-ink-500">{PERP_NOTE}</p>
        {!open ? <p className="border-b border-ink-700/40 px-4 py-2 text-xs text-ink-400">{marketShort(market, names)} is closed right now. You can design and save; the checker refuses an open until it reopens.</p> : null}
        {savedNote ? <p className="border-b border-ink-700/40 px-4 py-2 text-xs text-ink-400">{savedNote}</p> : null}
        {proposals.map((p) => (
          <ProposalCard
            key={p.id}
            proposal={p}
            currentSpec={savedSpec ?? spec}
            currentBacktest={run.result ?? props.savedBacktest}
            strategyStatus={paper?.status ?? draft.status}
            now={now}
            onDecided={(status, note) => {
              setProposals((prev) => prev.filter((x) => x.id !== p.id));
              setSavedNote(note);
              if (status === "accepted" && p.kind === "change" && p.proposedSpec) {
                const next = { ...p.proposedSpec, id: p.strategyId, status: "draft" as const };
                setSavedSpec(next);
                window.location.reload();
              } else if (status === "accepted") {
                const nextStatus = p.kind === "paper-start" ? ("paper" as const) : ("draft" as const);
                dispatch({ type: "status", status: nextStatus });
                setSavedSpec((prev) => (prev ? { ...prev, status: nextStatus } : prev));
                if (draft.id) void paperStateAction(draft.id).then((r) => r.ok && setPaper(r.paper));
              }
              router.refresh();
            }}
          />
        ))}
        {paper?.open ? (
          <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1 border-b border-ink-700/40 px-4 py-2 text-xs">
            <span className="font-medium text-signal-400">Paper long</span>
            <span className="tabular-nums text-ink-200">{formatUsd(paper.open.notionalUsd, 0)} at {paper.open.leverage}x from {formatPrice(paper.open.entryPrice)}</span>
            <span className="tabular-nums text-ink-400">liquidation {formatPrice(paper.open.liquidationPrice)}</span>
            {paper.open.takeProfit ? <span className="tabular-nums text-ink-400">take profit {formatPrice(paper.open.takeProfit)}</span> : null}
            {paper.open.stopLoss ? <span className="tabular-nums text-ink-400">stop loss {formatPrice(paper.open.stopLoss)}</span> : null}
            {mid ? (
              <span className={cn("tabular-nums", unrealised(paper.open, mid) < 0 ? "text-rose-400" : "text-ink-50")}>
                {unrealised(paper.open, mid) >= 0 ? "+" : "−"}{formatUsd(Math.abs(unrealised(paper.open, mid)))} live
              </span>
            ) : null}
            <span className="text-ink-500">opened {new Date(paper.open.openedAt).toISOString().slice(0, 10)}</span>
          </div>
        ) : null}
        {sinceLine ? <p className="border-b border-ink-700/40 px-4 py-2 text-xs text-ink-300">{sinceLine}</p> : null}

        <div className="relative h-[420px] bg-ink-900">
          {candles ? <PriceChart candles={candles} overlays={overlays} pane={pane} markers={markers} priceLines={priceLines} /> : null}
          {!candles ? (
            <p className="absolute inset-0 flex items-center justify-center text-sm text-ink-400">{candleError ?? "Loading history…"}</p>
          ) : null}
        </div>

        <ResultsTabs result={run.result} error={run.error} startUsd={draft.size.collateralUsd} paper={paper} symbol={market.symbol} />
        {draft.id ? (
          <div className="border-t border-ink-700/40 p-4">
            <ConnectCard baseUrl={props.baseUrl} alias={serverAlias(name, draft.id)} path={serverPath(draft.id)} server={draft.id} initial={props.initialConnections} />
          </div>
        ) : null}
      </section>

      <aside className="border-t border-ink-700/40 lg:sticky lg:top-16 lg:h-[calc(100vh-4rem)] lg:overflow-y-auto lg:border-l lg:border-t-0">
        <RulePanel
          draft={draft}
          dispatch={dispatch}
          market={market}
          mid={mid}
          name={name}
          issues={issues}
          risk={risk}
          costs={costs}
          liquidationPrice={liquidationPrice}
          cap={cap}
          dirty={dirty}
          saving={saving}
          saveError={saveError}
          saveRefusals={saveRefusals}
          onSave={onSave}
          paper={{ status: paper?.status ?? draft.status, since: paper?.since ?? null, blownOutAt: paper?.blownOutAt ?? null }}
          onStart={() => togglePaper("paper")}
          onStop={() => togglePaper("draft")}
          toggling={toggling}
          paperNote={paperNote}
        />
      </aside>
    </div>
  );
}

function useNow(everyMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), everyMs);
    return () => clearInterval(t);
  }, [everyMs]);
  return now;
}

function formatCountdown(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `in ${h}h ${m}m` : `in ${m}m`;
}
