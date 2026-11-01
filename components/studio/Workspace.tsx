"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState, useTransition } from "react";

import { candlesAction, marketsAction, saveStrategyAction } from "@/app/(app)/studio/strategies/actions";
import { PriceChart } from "@/components/charts/dynamic";
import { MarketsRail } from "@/components/studio/MarketsRail";
import { RulePanel } from "@/components/studio/RulePanel";
import { ResultsTabs } from "@/components/studio/ResultsTabs";
import { useDebouncedValue } from "@/components/studio/useDebouncedValue";
import { useLivePrices } from "@/components/studio/useLivePrices";
import { inputClasses } from "@/components/ui/Input";
import { checkRisk, type RiskFinding } from "@/lib/risk/check";
import { BacktestError, runBacktest, tradeCosts, type BacktestResult } from "@/lib/strategies/backtest";
import { markersFor, overlaysFor, paneFor } from "@/lib/strategies/chart-data";
import { draftReducer, generatedName, leverageCap, toSpec, type Draft } from "@/lib/strategies/draft";
import { LIQUIDATION_LOSS_FRACTION, StrategySpecSchema, type StrategySpec } from "@/lib/strategies/spec";
import { cn } from "@/lib/utils";
import { formatAgo, formatPrice } from "@/lib/venues/format";
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
}

const DAY_MS = 86_400_000;

export function Workspace(props: WorkspaceProps) {
  const router = useRouter();
  const [markets, setMarkets] = useState(props.markets);
  const [changes, setChanges] = useState(props.changes);
  const [draft, dispatch] = useReducer(draftReducer, props.initialDraft);
  const [savedSpec, setSavedSpec] = useState<StrategySpec | null>(props.savedSpec);
  const live = useLivePrices(props.prices, true);
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
  const markers = useMemo(() => markersFor(run.result), [run.result]);

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
        <MarketsRail markets={markets} prices={live.prices} changes={changes} selectedId={market.id} onSelect={(id) => dispatch({ type: "market", marketId: id, leverageCap: leverageCap(marketsById.get(id) ?? market, draft.tier).cap })} />
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
                  {m.symbol}
                </option>
              ))}
            </select>
            <h1 className="hidden font-display text-xl font-semibold text-ink-50 lg:block">{market.symbol}</h1>
            <span className="text-lg tabular-nums text-ink-100">{mid ? formatPrice(mid) : "–"}</span>
            <span className={cn("text-xs tabular-nums", change === undefined ? "text-ink-500" : change < 0 ? "text-rose-400" : "text-ink-400")}>
              {change === undefined ? "" : `${change >= 0 ? "+" : "−"}${Math.abs(change).toFixed(2)}% today`}
            </span>
            <span className="text-xs text-ink-400">{open ? "Open" : "Closed"} · {market.category}</span>
          </div>
          <p className="text-[11px] text-ink-500">
            {live.state === "live" && live.lastTickAt ? `Live · ${formatAgo(live.lastTickAt, now)}` : live.state === "retrying" ? "Reconnecting" : "Connecting"} · next check at daily close, {formatCountdown(nextClose - now)}
          </p>
        </div>
        {!open ? <p className="border-b border-ink-700/40 px-4 py-2 text-xs text-ink-400">{market.symbol} is closed right now. You can design and save; the checker refuses an open until it reopens.</p> : null}
        {savedNote ? <p className="border-b border-ink-700/40 px-4 py-2 text-xs text-ink-400">{savedNote}</p> : null}

        <div className="relative h-[420px] bg-ink-900">
          {candles ? <PriceChart candles={candles} overlays={overlays} pane={pane} markers={markers} /> : null}
          {!candles ? (
            <p className="absolute inset-0 flex items-center justify-center text-sm text-ink-400">{candleError ?? "Loading history…"}</p>
          ) : null}
        </div>

        <ResultsTabs result={run.result} error={run.error} startUsd={draft.size.collateralUsd} />
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
