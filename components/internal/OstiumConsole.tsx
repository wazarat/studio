"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";

import {
  devApproveAction,
  devCloseAction,
  devOpenAction,
  devStatusAction,
  devUpdateAction,
  devWalletAction,
  previewAction,
  rolloverAction,
  runPaperTickAction,
  type PreviewOutcome,
} from "@/app/(app)/internal/ostium/actions";
import type { TickReport } from "@/lib/paper/store";
import { useProjectCrumb } from "@/components/layout/AppShellContext";
import { Button } from "@/components/ui/Button";
import { Card, CardSection } from "@/components/ui/Card";
import { ChipRadioGroup } from "@/components/ui/ChipGroup";
import { Field, Input } from "@/components/ui/Input";
import { Toast } from "@/components/ui/Toast";
import type { PriceComparison } from "@/lib/chainlink/compare";
import type { StrategyRiskState, Tier } from "@/lib/risk/check";
import type { FillRow, RolloverPoint, WalletBalances } from "@/lib/venues/ostium";
import { formatAgo, formatBps, formatCountdown, formatPrice, formatUsd, formatUsdCompact } from "@/lib/venues/format";
import type { Hex, Market, OpenIntent, Position, Price, Side } from "@/lib/venues/types";
import { cn } from "@/lib/utils";

/**
 * The internal Ostium console (Studio step 3). Markets and prices come in
 * from the server, then the SSE route keeps prices and the Chainlink
 * comparison live. Everything is plain text in the canhav.dev language:
 * hairline tables, tabular figures, status as sentences, rose only for a
 * problem and emerald only for "within the band".
 */

interface Initial {
  markets: Market[];
  prices: Price[];
  comparisons: PriceComparison[];
  loadError: string | null;
  referenceError: string | null;
  at: number;
}

interface Props {
  testnet: boolean;
  builderAddress: string | null;
  toleranceBps: number;
  devSignerAddress: string | null;
  signerError: string | null;
  initial: Initial;
}

const TABLE = "overflow-x-auto rounded-lg border border-ink-700/60";
const TH = "px-3 py-2 font-medium";
const TD = "px-3 py-2";
const NUM = "px-3 py-2 tabular-nums";
const LINK = "text-ink-300 underline-offset-2 hover:text-ink-50 hover:underline";

const TIERS = [
  { value: "studio", label: "Studio, 5x" },
  { value: "studio-plus", label: "Studio+, 15x" },
] as const;
const SIDES = [
  { value: "long", label: "Long" },
  { value: "short", label: "Short" },
] as const;

function explorerTx(testnet: boolean, hash: string): string {
  return `${testnet ? "https://sepolia.arbiscan.io" : "https://arbiscan.io"}/tx/${hash}`;
}

function short(hash: string): string {
  return `${hash.slice(0, 8)}…${hash.slice(-6)}`;
}

function useNow(everyMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), everyMs);
    return () => clearInterval(t);
  }, [everyMs]);
  return now;
}

function numberOr(value: string, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function OstiumConsole({ testnet, builderAddress, toleranceBps, devSignerAddress, signerError, initial }: Props) {
  useProjectCrumb("Ostium");
  const now = useNow();

  /* ---------- live prices over SSE ---------- */
  const [prices, setPrices] = useState<Record<string, Price>>(() =>
    Object.fromEntries(initial.prices.map((p) => [p.marketId, p])),
  );
  const [comparisons, setComparisons] = useState<Record<string, PriceComparison>>(() =>
    Object.fromEntries(initial.comparisons.map((c) => [c.symbol, c])),
  );
  const [referenceAt, setReferenceAt] = useState<number>(initial.at);
  const [lastTickAt, setLastTickAt] = useState<number | null>(null);
  const [streamState, setStreamState] = useState<"connecting" | "live" | "retrying">("connecting");
  const [streamError, setStreamError] = useState<string | null>(initial.referenceError);

  useEffect(() => {
    const es = new EventSource("/api/internal/ostium/prices");
    es.addEventListener("price", (e) => {
      const price = JSON.parse((e as MessageEvent).data) as Price;
      setPrices((prev) => ({ ...prev, [price.marketId]: price }));
      setLastTickAt(Date.now());
      setStreamState("live");
    });
    es.addEventListener("reference", (e) => {
      const data = JSON.parse((e as MessageEvent).data) as { comparisons: PriceComparison[]; at: number };
      setComparisons((prev) => {
        const next = { ...prev };
        for (const c of data.comparisons) next[c.symbol] = c;
        return next;
      });
      setReferenceAt(data.at);
      setStreamError(null);
    });
    es.addEventListener("status", (e) => {
      const data = JSON.parse((e as MessageEvent).data) as { error?: string; connected?: boolean };
      if (data.error) setStreamError(data.error);
      else if (data.connected) setStreamState("live");
    });
    es.onerror = () => setStreamState("retrying");
    return () => es.close();
  }, []);

  const markets = initial.markets;
  const marketById = useMemo(() => new Map(markets.map((m) => [m.id, m])), [markets]);
  const openCount = markets.filter((m) => prices[m.id]?.isOpen ?? m.hours.isOpen).length;
  const feedCount = Object.keys(comparisons).length;

  /* ---------- preview form ---------- */
  const [marketId, setMarketId] = useState(markets[0]?.id ?? "");
  const [side, setSide] = useState<Side>("long");
  const [collateral, setCollateral] = useState("10");
  const [leverage, setLeverage] = useState("2");
  const [isDayTrade, setIsDayTrade] = useState(false);
  const [tier, setTier] = useState<Tier>("studio");
  const [openNotional, setOpenNotional] = useState("0");
  const [dailyLossLimit, setDailyLossLimit] = useState("");
  const [lossToday, setLossToday] = useState("0");
  const [outcome, setOutcome] = useState<PreviewOutcome | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewing, startPreview] = useTransition();

  const intent: OpenIntent = useMemo(
    () => ({
      marketId,
      side,
      collateralUsd: numberOr(collateral, 0),
      leverage: numberOr(leverage, 0),
      orderType: "market",
      isDayTrade,
    }),
    [marketId, side, collateral, leverage, isDayTrade],
  );
  const strategy: StrategyRiskState = useMemo(
    () => ({
      strategyId: "internal-console",
      openNotionalUsd: numberOr(openNotional, 0),
      dailyLossLimitUsd: numberOr(dailyLossLimit, 0),
      lossTodayUsd: numberOr(lossToday, 0),
    }),
    [openNotional, dailyLossLimit, lossToday],
  );

  const runPreview = useCallback(() => {
    if (!intent.marketId || intent.collateralUsd <= 0 || intent.leverage <= 0) return;
    startPreview(async () => {
      const res = await previewAction(intent, tier, strategy);
      if (res.ok) {
        setOutcome({ preview: res.preview, risk: res.risk, reference: res.reference });
        setPreviewError(null);
      } else {
        setOutcome(null);
        setPreviewError(res.error);
      }
    });
  }, [intent, tier, strategy]);

  // Debounced preview as the form changes.
  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (previewTimer.current) clearTimeout(previewTimer.current);
    previewTimer.current = setTimeout(runPreview, 400);
    return () => {
      if (previewTimer.current) clearTimeout(previewTimer.current);
    };
  }, [runPreview]);

  const [rollover, setRollover] = useState<{ marketId: string; points: RolloverPoint[] } | null>(null);
  const [rolloverError, setRolloverError] = useState<string | null>(null);
  const [loadingRollover, startRollover] = useTransition();
  const loadRollover = () =>
    startRollover(async () => {
      const res = await rolloverAction(marketId);
      if (res.ok) {
        setRollover({ marketId, points: res.points });
        setRolloverError(null);
      } else setRolloverError(res.error);
    });

  /* ---------- test trades ---------- */
  const [wallet, setWallet] = useState<{ balances: WalletBalances; positions: Position[]; fills: FillRow[] } | null>(null);
  const [walletError, setWalletError] = useState<string | null>(null);
  const [walletAt, setWalletAt] = useState<number | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<React.ReactNode>(null);
  const [tpInput, setTpInput] = useState("");
  const [slInput, setSlInput] = useState("");
  const [lastHashes, setLastHashes] = useState<{ hash: Hex; label: string; at: number; status?: string }[]>([]);

  const refreshWallet = useCallback(async () => {
    const res = await devWalletAction();
    if (res.ok) {
      setWallet({ balances: res.balances, positions: res.positions, fills: res.fills });
      setWalletError(null);
    } else setWalletError(res.error);
    setWalletAt(Date.now());
  }, []);

  useEffect(() => {
    if (devSignerAddress) void refreshWallet();
  }, [devSignerAddress, refreshWallet]);

  const recordHash = useCallback(
    (hash: Hex, label: string) => {
      setLastHashes((prev) => [{ hash, label, at: Date.now() }, ...prev].slice(0, 8));
      setToast(
        <>
          {label} sent.{" "}
          <a className={LINK} href={explorerTx(testnet, hash)} target="_blank" rel="noreferrer">
            {short(hash)}
          </a>
        </>,
      );
      // Ostium executes a few seconds after the transaction lands; read back then.
      setTimeout(async () => {
        const status = await devStatusAction(hash);
        if (status.ok) {
          const o = status.orders[0];
          const text = !o
            ? "not indexed yet"
            : o.isCancelled
              ? `cancelled${o.cancelReason ? `: ${o.cancelReason}` : ""}`
              : o.isPending
                ? "pending"
                : `executed${o.price ? ` at ${formatPrice(o.price)}` : ""}`;
          setLastHashes((prev) => prev.map((h) => (h.hash === hash ? { ...h, status: text } : h)));
        }
        void refreshWallet();
      }, 12_000);
    },
    [testnet, refreshWallet],
  );

  const run = async (label: string, fn: () => Promise<{ ok: true; hashes: Hex[] } | { ok: false; error: string }>) => {
    setBusy(label);
    try {
      const res = await fn();
      if (!res.ok) setToast(`${label} failed: ${res.error}`);
      else for (const h of res.hashes) recordHash(h, label);
    } finally {
      setBusy(null);
    }
  };

  const approve = () =>
    run("Approve 100 USDC", async () => {
      const r = await devApproveAction(100);
      return r.ok ? { ok: true, hashes: [r.hash] } : r;
    });
  const openTrade = () =>
    run("Open", async () => {
      const r = await devOpenAction(intent, tier, strategy);
      if (!r.ok) return r;
      setOutcome(r.outcome);
      if (!r.hash) return { ok: false, error: `refused by the checker (${r.outcome.risk.refusals.map((f) => f.code).join(", ")})` };
      return { ok: true, hashes: [r.hash] };
    });
  const closePosition = (p: Position) =>
    run(`Close ${p.symbol}`, async () => {
      const r = await devCloseAction({ marketId: p.marketId, index: p.index, closePercent: 100 });
      return r.ok ? { ok: true, hashes: [r.hash] } : r;
    });
  const setTpSl = (p: Position) =>
    run(`TP/SL ${p.symbol}`, () =>
      devUpdateAction({
        marketId: p.marketId,
        index: p.index,
        takeProfit: tpInput === "" ? undefined : numberOr(tpInput, 0) || null,
        stopLoss: slInput === "" ? undefined : numberOr(slInput, 0) || null,
      }),
    );
  const topUp = (p: Position) =>
    run(`+$5 ${p.symbol}`, () => devUpdateAction({ marketId: p.marketId, index: p.index, collateralDeltaUsd: 5 }));

  const selected = marketById.get(marketId);

  /* ---------- paper tick ---------- */
  const [tick, setTick] = useState<TickReport | null>(null);
  const [tickError, setTickError] = useState<string | null>(null);
  const [ticking, startTick] = useTransition();
  const runTickNow = () =>
    startTick(async () => {
      setTickError(null);
      const res = await runPaperTickAction();
      if (res.ok) setTick(res.report);
      else setTickError(res.error);
    });

  return (
    <div className="container space-y-10 py-10 md:py-14">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl">
          <p className="kicker">Internal</p>
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight text-ink-50 md:text-4xl">Ostium</h1>
          <p className="mt-3 text-sm leading-relaxed text-ink-400">
            Market data from Arbitrum One · trades {testnet ? "on Arbitrum Sepolia (testnet)" : "on Arbitrum One"} · {markets.length} markets, {openCount} open ·{" "}
            {feedCount} with a Chainlink feed, ±{toleranceBps} bps band ·{" "}
            {builderAddress ? `builder ${short(builderAddress)}, fee 0` : "no builder address set"}
          </p>
        </div>
        <p className={cn("text-xs", streamState === "retrying" ? "text-rose-400" : "text-ink-400")}>
          {streamState === "live" && lastTickAt
            ? `Live · last tick ${formatAgo(lastTickAt, now)}`
            : streamState === "retrying"
              ? "Price stream lost, reconnecting"
              : "Connecting to the price stream"}
          {" · "}Chainlink read {formatAgo(referenceAt, now)}
        </p>
      </div>

      {initial.loadError ? (
        <p className="text-sm text-rose-400">Ostium could not be read: {initial.loadError}</p>
      ) : null}
      {streamError ? <p className="text-sm text-rose-400">Chainlink: {streamError}</p> : null}

      {/* Markets and prices */}
      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold text-ink-50">Markets</h2>
        <div className={TABLE}>
          <table className="w-full text-left text-xs">
            <thead className="text-ink-500">
              <tr>
                <th className={TH}>Market</th>
                <th className={TH}>Hours</th>
                <th className={cn(TH, "text-right")}>Bid</th>
                <th className={cn(TH, "text-right")}>Mid</th>
                <th className={cn(TH, "text-right")}>Ask</th>
                <th className={cn(TH, "text-right")}>Chainlink</th>
                <th className={TH}>Check</th>
                <th className={cn(TH, "text-right")}>Max lev</th>
                <th className={cn(TH, "text-right")}>Overnight</th>
                <th className={cn(TH, "text-right")}>OI long / short</th>
                <th className={cn(TH, "text-right")}>OI max/side</th>
                <th className={cn(TH, "text-right")}>8h rollover L / S</th>
                <th className={cn(TH, "text-right")}>Fees</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-700/40 text-ink-200">
              {markets.map((m) => {
                const p = prices[m.id];
                const c = comparisons[m.symbol];
                const open = p?.isOpen ?? m.hours.isOpen;
                const toggle = formatCountdown(m.hours.secondsToToggleDayTrading);
                return (
                  <tr key={m.id} className={cn(!open && "text-ink-400")}>
                    <td className={TD}>
                      <button type="button" onClick={() => setMarketId(m.id)} className={cn("font-medium hover:underline", marketId === m.id ? "text-electric-300" : "text-ink-100")}>
                        {m.symbol}
                      </button>
                      <span className="ml-2 text-ink-500">{m.category}</span>
                    </td>
                    <td className={TD}>
                      {open ? "Open" : "Closed"}
                      {m.hours.isDayTradingClosed && open ? ", day trading closed" : ""}
                      {toggle ? ` · ${m.hours.isDayTradingClosed ? "day trading in" : "day trading closes in"} ${toggle}` : ""}
                    </td>
                    <td className={cn(NUM, "text-right")}>{p ? formatPrice(p.bid) : "–"}</td>
                    <td className={cn(NUM, "text-right text-ink-100")}>{p ? formatPrice(p.mid) : "–"}</td>
                    <td className={cn(NUM, "text-right")}>{p ? formatPrice(p.ask) : "–"}</td>
                    <td className={cn(NUM, "text-right")}>{c ? formatPrice(c.referencePrice) : "–"}</td>
                    <td className={TD}>
                      {!c ? (
                        <span className="text-ink-500">No feed</span>
                      ) : !c.fresh ? (
                        <span className="text-rose-400">Stale, {formatAgo(now - c.ageSeconds * 1000, now)}</span>
                      ) : c.withinTolerance ? (
                        <span className="text-emerald-400 light:text-emerald-700">{formatBps(c.deviationBps)}, within band</span>
                      ) : (
                        <span className="text-rose-400">{formatBps(c.deviationBps)}, outside band{testnet ? " (shown only on testnet)" : ""}</span>
                      )}
                    </td>
                    <td className={cn(NUM, "text-right")}>{m.limits.maxLeverage}x</td>
                    <td className={cn(NUM, "text-right")}>{m.limits.overnightMaxLeverage > 0 ? `${m.limits.overnightMaxLeverage}x` : "–"}</td>
                    <td className={cn(NUM, "text-right")}>
                      {formatUsdCompact(m.openInterest.longUsd)} / {formatUsdCompact(m.openInterest.shortUsd)}
                    </td>
                    <td className={cn(NUM, "text-right")}>{formatUsdCompact(m.openInterest.maxPerSideUsd)}</td>
                    <td className={cn(NUM, "text-right")}>
                      {m.rollover8h.long.toFixed(4)}% / {m.rollover8h.short.toFixed(4)}%
                    </td>
                    <td className={cn(NUM, "text-right")}>
                      {m.fees.openBps} bps + ${m.fees.oracleFeeUsd}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-ink-500">
          Chainlink is read from Arbitrum One in both modes. {testnet ? "On testnet the comparison is shown and never blocks." : "On mainnet a stale or out-of-band reference refuses the open."}{" "}
          Min notional is ${markets[0]?.limits.minNotionalUsd ?? 5} on every market.
        </p>
      </section>

      {/* Preview */}
      <section className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_1fr]">
        <Card>
          <CardSection className="space-y-4">
            <h2 className="font-display text-lg font-semibold text-ink-50">Preview</h2>
            <Field label="Market">
              <select value={marketId} onChange={(e) => setMarketId(e.target.value)} className="w-full rounded-lg border border-ink-700/60 bg-ink-950/50 px-3.5 py-2.5 text-sm text-ink-50 light:bg-ink-900 focus:border-electric-500 focus:outline-none">
                {markets.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.symbol}
                  </option>
                ))}
              </select>
            </Field>
            <ChipRadioGroup label="Side" value={side} onChange={(v) => v && setSide(v)} options={SIDES} />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Collateral, USDC">
                <Input inputMode="decimal" value={collateral} onChange={(e) => setCollateral(e.target.value)} />
              </Field>
              <Field label="Leverage">
                <Input inputMode="decimal" value={leverage} onChange={(e) => setLeverage(e.target.value)} />
              </Field>
            </div>
            <label className="flex items-center gap-2 text-xs text-ink-200">
              <input type="checkbox" checked={isDayTrade} onChange={(e) => setIsDayTrade(e.target.checked)} />
              Day trade (closed before the market closes; needed above the overnight limit)
            </label>
            <ChipRadioGroup label="Tier" value={tier} onChange={(v) => v && setTier(v)} options={TIERS} />
            <div className="grid grid-cols-3 gap-3">
              <Field label="Strategy open, $" hint="Already open">
                <Input inputMode="decimal" value={openNotional} onChange={(e) => setOpenNotional(e.target.value)} />
              </Field>
              <Field label="Daily stop, $" hint="0 = off">
                <Input inputMode="decimal" value={dailyLossLimit} onChange={(e) => setDailyLossLimit(e.target.value)} placeholder="limit" />
              </Field>
              <Field label="Lost today, $">
                <Input inputMode="decimal" value={lossToday} onChange={(e) => setLossToday(e.target.value)} />
              </Field>
            </div>
            <p className="text-xs text-ink-500">
              {previewing ? "Previewing…" : "Preview runs as you type."}{" "}
              <button type="button" className={LINK} onClick={runPreview}>
                Run again
              </button>
            </p>
          </CardSection>
        </Card>

        <Card>
          <CardSection className="space-y-4">
            <h2 className="font-display text-lg font-semibold text-ink-50">
              {selected?.symbol ?? "Market"} {side}, {collateral || "0"} USDC × {leverage || "0"}x
            </h2>
            {previewError ? <p className="text-sm text-rose-400">{previewError}</p> : null}
            {outcome ? (
              <>
                <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                  {(
                    [
                      ["Entry", formatPrice(outcome.preview.entryPrice)],
                      ["Mid", formatPrice(outcome.preview.midPrice)],
                      ["Price impact", `${outcome.preview.priceImpactPct.toFixed(4)}%`],
                      ["Position size", formatUsd(outcome.preview.sizeUsd)],
                      ["Liquidation", formatPrice(outcome.preview.liquidationPrice)],
                      ["Open fee", formatUsd(outcome.preview.fees.openUsd, 4)],
                      ["Oracle fee", formatUsd(outcome.preview.fees.oracleUsd, 2)],
                      ["Builder fee", formatUsd(outcome.preview.fees.builderUsd, 4)],
                      ["Total fees", formatUsd(outcome.preview.fees.totalUsd, 4)],
                      ["Max leverage here", `${outcome.preview.effectiveMaxLeverage}x`],
                      ["Max collateral now", `${formatUsd(outcome.preview.maxCollateralUsd)} (${outcome.preview.maxCollateralBound})`],
                      ["Min size", formatUsd(outcome.preview.minSizeUsd)],
                    ] as const
                  ).map(([k, v]) => (
                    <div key={k} className="flex items-baseline justify-between gap-4 border-b border-ink-700/40 pb-1">
                      <dt className="text-ink-500">{k}</dt>
                      <dd className="tabular-nums text-ink-100">{v}</dd>
                    </div>
                  ))}
                </dl>
                {outcome.preview.warnings.length > 0 ? (
                  <ul className="space-y-1 text-xs text-rose-400">
                    {outcome.preview.warnings.map((w) => (
                      <li key={w.code}>Ostium: {w.message}</li>
                    ))}
                  </ul>
                ) : null}
                <div className="border-t border-ink-700/40 pt-4">
                  <p className={cn("text-sm font-medium", outcome.risk.ok ? "text-emerald-400 light:text-emerald-700" : "text-rose-400")}>
                    {outcome.risk.ok ? "The checker allows this open." : "The checker refuses this open."}
                  </p>
                  <ul className="mt-2 space-y-1 text-xs">
                    {outcome.risk.refusals.map((f) => (
                      <li key={f.code} className="text-rose-400">
                        {f.message}
                      </li>
                    ))}
                    {outcome.risk.notes.map((f) => (
                      <li key={f.code} className="text-ink-400">
                        {f.message}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-xs text-ink-500">
                    Max leverage {outcome.risk.applied.maxLeverage}x · {formatUsd(outcome.risk.applied.remainingStrategyUsd)} left in the strategy cap ·{" "}
                    {formatUsdCompact(outcome.risk.applied.remainingOiUsd)} open interest left on this side
                    {outcome.reference
                      ? ` · Chainlink ${formatPrice(outcome.reference.referencePrice)}, ${formatBps(outcome.reference.deviationBps)}`
                      : " · no Chainlink feed"}
                  </p>
                </div>
              </>
            ) : previewError ? null : (
              <p className="text-sm text-ink-400">Waiting for a preview.</p>
            )}
            <div className="border-t border-ink-700/40 pt-4 text-xs text-ink-400">
              <button type="button" className={LINK} onClick={loadRollover} disabled={loadingRollover}>
                {loadingRollover ? "Reading rollover history…" : "Load 24h rollover history"}
              </button>
              {rolloverError ? <span className="ml-2 text-rose-400">{rolloverError}</span> : null}
              {rollover && rollover.marketId === marketId ? (
                <p className="mt-2 tabular-nums">
                  {rollover.points.length === 0
                    ? "No rollover points in the last 24h."
                    : rollover.points
                        .slice(-6)
                        .map((pt) => `${new Date(pt.at).toISOString().slice(11, 16)} ${pt.rate8hLong.toFixed(4)}% / ${pt.rate8hShort.toFixed(4)}%`)
                        .join(" · ")}
                </p>
              ) : null}
            </div>
          </CardSection>
        </Card>
      </section>

      {/* Paper trading */}
      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold text-ink-50">Paper trading</h2>
        <Card>
          <CardSection className="space-y-3">
            <p className="text-sm text-ink-300">
              One tick checks exits on every open paper position at the live bid, then runs the daily decision for every strategy on paper whose last closed candle has not been run. The cron calls the same function every five minutes.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Button size="sm" variant="secondary" disabled={ticking} onClick={runTickNow}>
                {ticking ? "Running…" : "Run tick now"}
              </Button>
              {tick ? (
                <span className="text-xs tabular-nums text-ink-400">
                  {tick.positionsChecked} positions checked · {tick.exits} exits · {tick.runs} runs · {tick.entries} entries · {tick.refusals} refusals · {tick.skips} skips
                </span>
              ) : null}
              {tickError ? <span className="text-xs text-rose-400">{tickError}</span> : null}
            </div>
            {tick && (tick.lines.length > 0 || tick.errors.length > 0) ? (
              <ul className="space-y-1 text-xs">
                {tick.lines.map((l, i) => (
                  <li key={`l${i}`} className="text-ink-300">
                    {l}
                  </li>
                ))}
                {tick.errors.map((e, i) => (
                  <li key={`e${i}`} className="text-rose-400">
                    {e}
                  </li>
                ))}
              </ul>
            ) : tick ? (
              <p className="text-xs text-ink-500">Nothing to do: no strategy on paper is due and no position needed an exit.</p>
            ) : null}
          </CardSection>
        </Card>
      </section>

      {/* Test trades */}
      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold text-ink-50">Test trades</h2>
        {!testnet ? (
          <p className="text-sm text-ink-400">Test trades are testnet-only.</p>
        ) : signerError ? (
          <p className="text-sm text-rose-400">{signerError}</p>
        ) : !devSignerAddress ? (
          <p className="text-sm text-ink-400">No dev signer. Put a funded Arbitrum Sepolia key in OSTIUM_DEV_PRIVATE_KEY in .env.local.</p>
        ) : (
          <Card>
            <CardSection className="space-y-3">
              <p className="text-sm text-ink-200">
                Signer <span className="font-mono text-xs text-electric-300">{devSignerAddress}</span>
                {wallet ? (
                  <span className="ml-2 tabular-nums text-ink-400">
                    · {wallet.balances.usdc.toFixed(2)} USDC · {wallet.balances.eth.toFixed(5)} ETH · allowance {wallet.balances.allowanceUsdc >= 1e9 ? "unlimited" : wallet.balances.allowanceUsdc.toFixed(2)} USDC
                  </span>
                ) : null}
              </p>
              <p className="text-xs text-ink-400">
                {walletAt ? `Wallet read ${formatAgo(walletAt, now)}` : "Reading the wallet…"} ·{" "}
                <button type="button" className={LINK} onClick={() => void refreshWallet()}>
                  Read again
                </button>
                {walletError ? <span className="ml-2 text-rose-400">{walletError}</span> : null}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" disabled={busy !== null} onClick={approve}>
                  Approve 100 USDC
                </Button>
                <Button size="sm" disabled={busy !== null || !outcome?.risk.ok} onClick={openTrade}>
                  Open the previewed trade
                </Button>
                <span className="self-center text-xs text-ink-500">
                  {busy ? `${busy}…` : outcome?.risk.ok ? "Builds through the venue layer, passes the checker, then signs." : "Fix the preview first; a refused open never signs."}
                </span>
              </div>
            </CardSection>

            <CardSection className="space-y-3">
              <h3 className="text-sm font-medium text-ink-100">Open positions</h3>
              {!wallet || wallet.positions.length === 0 ? (
                <p className="text-xs text-ink-400">None open.</p>
              ) : (
                <div className={TABLE}>
                  <table className="w-full text-left text-xs">
                    <thead className="text-ink-500">
                      <tr>
                        <th className={TH}>Market</th>
                        <th className={TH}>Side</th>
                        <th className={cn(TH, "text-right")}>Size</th>
                        <th className={cn(TH, "text-right")}>Collateral</th>
                        <th className={cn(TH, "text-right")}>Lev</th>
                        <th className={cn(TH, "text-right")}>Entry</th>
                        <th className={cn(TH, "text-right")}>Liq</th>
                        <th className={cn(TH, "text-right")}>PnL</th>
                        <th className={cn(TH, "text-right")}>TP / SL</th>
                        <th className={TH}>Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-ink-700/40 text-ink-200">
                      {wallet.positions.map((p) => (
                        <tr key={`${p.marketId}-${p.index}`}>
                          <td className={cn(TD, "text-ink-100")}>{p.symbol} #{p.index}</td>
                          <td className={TD}>{p.side}{p.isDayTrade ? ", day" : ""}</td>
                          <td className={cn(NUM, "text-right")}>{formatUsd(p.sizeUsd)}</td>
                          <td className={cn(NUM, "text-right")}>{formatUsd(p.collateralUsd)}</td>
                          <td className={cn(NUM, "text-right")}>{p.leverage}x</td>
                          <td className={cn(NUM, "text-right")}>{formatPrice(p.entryPrice)}</td>
                          <td className={cn(NUM, "text-right")}>{formatPrice(p.liquidationPrice)}</td>
                          <td className={cn(NUM, "text-right", p.unrealizedPnlUsd < 0 ? "text-rose-400" : "")}>{formatUsd(p.unrealizedPnlUsd)}</td>
                          <td className={cn(NUM, "text-right")}>
                            {p.takeProfit ? formatPrice(p.takeProfit) : "–"} / {p.stopLoss ? formatPrice(p.stopLoss) : "–"}
                          </td>
                          <td className={cn(TD, "space-x-3 whitespace-nowrap")}>
                            <button type="button" className={LINK} disabled={busy !== null} onClick={() => setTpSl(p)}>
                              Set TP/SL
                            </button>
                            <button type="button" className={LINK} disabled={busy !== null} onClick={() => topUp(p)}>
                              +$5 collateral
                            </button>
                            <button type="button" className="text-ink-400 underline-offset-2 hover:text-rose-400 hover:underline" disabled={busy !== null} onClick={() => closePosition(p)}>
                              Close 100%
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="grid max-w-md grid-cols-2 gap-3">
                <Field label="Take profit price" hint="Blank leaves it, 0 clears it">
                  <Input inputMode="decimal" value={tpInput} onChange={(e) => setTpInput(e.target.value)} />
                </Field>
                <Field label="Stop loss price">
                  <Input inputMode="decimal" value={slInput} onChange={(e) => setSlInput(e.target.value)} />
                </Field>
              </div>
            </CardSection>

            {lastHashes.length > 0 ? (
              <CardSection className="space-y-1 text-xs text-ink-300">
                <h3 className="text-sm font-medium text-ink-100">Sent</h3>
                {lastHashes.map((h) => (
                  <p key={h.hash} className="tabular-nums">
                    {h.label} ·{" "}
                    <a className={LINK} href={explorerTx(testnet, h.hash)} target="_blank" rel="noreferrer">
                      {short(h.hash)}
                    </a>{" "}
                    · {formatAgo(h.at, now)}{h.status ? ` · ${h.status}` : ""}
                  </p>
                ))}
              </CardSection>
            ) : null}

            <CardSection className="space-y-3">
              <h3 className="text-sm font-medium text-ink-100">Fills</h3>
              {!wallet || wallet.fills.length === 0 ? (
                <p className="text-xs text-ink-400">No fills yet for this signer.</p>
              ) : (
                <div className={TABLE}>
                  <table className="w-full text-left text-xs">
                    <thead className="text-ink-500">
                      <tr>
                        <th className={TH}>When</th>
                        <th className={TH}>Market</th>
                        <th className={TH}>Action</th>
                        <th className={TH}>Side</th>
                        <th className={cn(TH, "text-right")}>Price</th>
                        <th className={cn(TH, "text-right")}>Size</th>
                        <th className={cn(TH, "text-right")}>Lev</th>
                        <th className={cn(TH, "text-right")}>Fees</th>
                        <th className={cn(TH, "text-right")}>Closed PnL</th>
                        <th className={TH}>Tx</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-ink-700/40 text-ink-200">
                      {wallet.fills.map((f) => (
                        <tr key={`${f.hash}-${f.action}-${f.at}`}>
                          <td className={cn(TD, "whitespace-nowrap")}>{new Date(f.at).toISOString().slice(0, 16).replace("T", " ")}</td>
                          <td className={cn(TD, "text-ink-100")}>{f.symbol}</td>
                          <td className={TD}>{f.action}</td>
                          <td className={TD}>{f.side}</td>
                          <td className={cn(NUM, "text-right")}>{formatPrice(f.price)}</td>
                          <td className={cn(NUM, "text-right")}>{formatUsd(f.sizeUsd)}</td>
                          <td className={cn(NUM, "text-right")}>{f.leverage}x</td>
                          <td className={cn(NUM, "text-right")}>{formatUsd(f.fees.opening + f.fees.oracle + f.fees.builder + f.fees.rollover + f.fees.priceImpact, 4)}</td>
                          <td className={cn(NUM, "text-right", f.closedPnlUsd < 0 ? "text-rose-400" : "")}>{formatUsd(f.closedPnlUsd)}</td>
                          <td className={TD}>
                            <a className={LINK} href={explorerTx(testnet, f.hash)} target="_blank" rel="noreferrer">
                              {short(f.hash)}
                            </a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardSection>
          </Card>
        )}
      </section>

      {toast ? <Toast onDismiss={() => setToast(null)}>{toast}</Toast> : null}
    </div>
  );
}
