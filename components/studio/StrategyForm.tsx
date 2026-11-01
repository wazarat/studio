"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { createStrategyAction, type MarketOption } from "@/app/(app)/studio/strategies/actions";
import { Button } from "@/components/ui/Button";
import { Card, CardSection } from "@/components/ui/Card";
import { ChipRadioGroup } from "@/components/ui/ChipGroup";
import { Field, Input } from "@/components/ui/Input";
import type { RiskFinding } from "@/lib/risk/check";
import type { Tier } from "@/lib/risk/check";
import { inputClasses } from "@/components/ui/Input";
import { cn } from "@/lib/utils";

/**
 * The simple strategy form (step 4). Direction and wake trigger are shown
 * as text because only long and daily close exist yet. Numbers are typed as
 * strings and parsed on submit; the server validates the spec again.
 */

type EntryKind = "maCross" | "rsi" | "breakout";

const ENTRY_OPTIONS = [
  { value: "maCross", label: "Moving average cross" },
  { value: "rsi", label: "RSI" },
  { value: "breakout", label: "Breakout" },
] as const;
const TIERS = [
  { value: "studio", label: "Studio, 5x" },
  { value: "studio-plus", label: "Studio+, 15x" },
] as const;

const num = (v: string): number | undefined => (v.trim() === "" ? undefined : Number(v));

export function StrategyForm({ markets }: { markets: MarketOption[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [marketId, setMarketId] = useState(markets[0]?.id ?? "");
  const [entry, setEntry] = useState<EntryKind>("maCross");
  const [fast, setFast] = useState("10");
  const [slow, setSlow] = useState("30");
  const [period, setPeriod] = useState("14");
  const [buyBelow, setBuyBelow] = useState("30");
  const [lookback, setLookback] = useState("20");
  const [takeProfit, setTakeProfit] = useState("");
  const [stopLoss, setStopLoss] = useState("");
  const [collateral, setCollateral] = useState("100");
  const [leverage, setLeverage] = useState("2");
  const [maxPosition, setMaxPosition] = useState("1000");
  const [dailyLoss, setDailyLoss] = useState("50");
  const [tier, setTier] = useState<Tier>("studio");
  const [error, setError] = useState<string | null>(null);
  const [refusals, setRefusals] = useState<RiskFinding[]>([]);
  const [pending, start] = useTransition();

  const market = useMemo(() => markets.find((m) => m.id === marketId), [markets, marketId]);

  const submit = () => {
    setError(null);
    setRefusals([]);
    const entryRule =
      entry === "maCross"
        ? { kind: "maCross", fast: num(fast), slow: num(slow) }
        : entry === "rsi"
          ? { kind: "rsi", period: num(period), buyBelow: num(buyBelow) }
          : { kind: "breakout", lookback: num(lookback) };
    const raw = {
      name,
      market: { venue: "ostium", marketId, symbol: market?.symbol },
      direction: "long",
      entry: entryRule,
      exit: { takeProfitPct: num(takeProfit), stopLossPct: num(stopLoss) },
      size: { collateralUsd: num(collateral), leverage: num(leverage) },
      wake: { kind: "candle-close", resolution: "1D" },
      caps: { maxPositionUsd: num(maxPosition), dailyLossLimitUsd: num(dailyLoss) ?? 0 },
      tier,
    };
    start(async () => {
      const res = await createStrategyAction(raw);
      if (!res.ok) {
        setError(res.error);
        setRefusals(res.refusals ?? []);
        return;
      }
      router.push(`/studio/strategies/${res.id}${res.warnings.length ? "?warn=closed" : ""}`);
    });
  };

  return (
    <Card className="mt-8 max-w-2xl">
      <CardSection className="space-y-5">
        <Field label="Name" required>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="BTC trend" maxLength={60} />
        </Field>
        <Field
          label="Market"
          hint={
            market
              ? `${market.category} · max ${market.maxLeverage}x${market.overnightMaxLeverage ? `, ${market.overnightMaxLeverage}x overnight` : ""} · open fee ${market.openBps} bps · ${market.isOpen ? "open now" : "closed now"}`
              : undefined
          }
        >
          <select value={marketId} onChange={(e) => setMarketId(e.target.value)} className={cn(inputClasses, "appearance-none")}>
            {markets.map((m) => (
              <option key={m.id} value={m.id}>
                {m.symbol}
              </option>
            ))}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs font-medium text-ink-200">Direction</p>
            <p className="mt-1.5 text-ink-300">Long</p>
          </div>
          <div>
            <p className="text-xs font-medium text-ink-200">Wake trigger</p>
            <p className="mt-1.5 text-ink-300">Daily candle close</p>
          </div>
        </div>
      </CardSection>

      <CardSection className="space-y-5">
        <ChipRadioGroup label="Entry rule" value={entry} onChange={(v) => v && setEntry(v)} options={ENTRY_OPTIONS} hint="Exits on the opposite signal, plus the take profit and stop loss below." />
        {entry === "maCross" ? (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Fast average, days">
              <Input inputMode="numeric" value={fast} onChange={(e) => setFast(e.target.value)} />
            </Field>
            <Field label="Slow average, days">
              <Input inputMode="numeric" value={slow} onChange={(e) => setSlow(e.target.value)} />
            </Field>
          </div>
        ) : entry === "rsi" ? (
          <div className="grid grid-cols-2 gap-3">
            <Field label="RSI period, days">
              <Input inputMode="numeric" value={period} onChange={(e) => setPeriod(e.target.value)} />
            </Field>
            <Field label="Buy when RSI recovers above" hint="Sells when it drops below 100 minus this">
              <Input inputMode="numeric" value={buyBelow} onChange={(e) => setBuyBelow(e.target.value)} />
            </Field>
          </div>
        ) : (
          <Field label="Lookback, days" hint="Buys a close above the period's high, sells a close below its low">
            <Input inputMode="numeric" value={lookback} onChange={(e) => setLookback(e.target.value)} />
          </Field>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Take profit, %" hint="Optional">
            <Input inputMode="decimal" value={takeProfit} onChange={(e) => setTakeProfit(e.target.value)} />
          </Field>
          <Field label="Stop loss, %" hint="Optional, inside the liquidation distance">
            <Input inputMode="decimal" value={stopLoss} onChange={(e) => setStopLoss(e.target.value)} />
          </Field>
        </div>
      </CardSection>

      <CardSection className="space-y-5">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Collateral, USDC">
            <Input inputMode="decimal" value={collateral} onChange={(e) => setCollateral(e.target.value)} />
          </Field>
          <Field label="Leverage">
            <Input inputMode="decimal" value={leverage} onChange={(e) => setLeverage(e.target.value)} />
          </Field>
          <Field label="Max position, $" hint="Open notional cap, at most 1,000">
            <Input inputMode="decimal" value={maxPosition} onChange={(e) => setMaxPosition(e.target.value)} />
          </Field>
          <Field label="Daily loss stop, $" hint="0 turns it off">
            <Input inputMode="decimal" value={dailyLoss} onChange={(e) => setDailyLoss(e.target.value)} />
          </Field>
        </div>
        <ChipRadioGroup label="Tier" value={tier} onChange={(v) => v && setTier(v)} options={TIERS} />
      </CardSection>

      <CardSection className="space-y-3">
        {error ? <p className="text-sm text-rose-400">{error}</p> : null}
        {refusals.length > 0 ? (
          <ul className="space-y-1 text-xs text-rose-400">
            {refusals.map((f) => (
              <li key={f.code}>{f.message}</li>
            ))}
          </ul>
        ) : null}
        <div className="flex items-center gap-3">
          <Button type="button" onClick={submit} disabled={pending || !name.trim() || !marketId}>
            {pending ? "Saving and backtesting…" : "Save and backtest"}
          </Button>
          <span className="text-xs text-ink-500">Runs the checker, saves a draft, then backtests the whole history.</span>
        </div>
      </CardSection>
    </Card>
  );
}
