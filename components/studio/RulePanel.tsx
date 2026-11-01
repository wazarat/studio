"use client";

import { Button } from "@/components/ui/Button";
import { ChipRadioGroup } from "@/components/ui/ChipGroup";
import { Field, Input } from "@/components/ui/Input";
import type { RiskFinding, RiskResult, Tier } from "@/lib/risk/check";
import { DEFAULT_RISK_LIMITS } from "@/lib/risk/check";
import type { TradeCosts } from "@/lib/strategies/backtest";
import { refusalSlot, type Draft, type DraftAction, type LeverageCap } from "@/lib/strategies/draft";
import type { EntryRule } from "@/lib/strategies/spec";
import { cn } from "@/lib/utils";
import { formatPrice, formatUsd } from "@/lib/venues/format";
import type { Market } from "@/lib/venues/types";

/**
 * The strategy panel (Studio step 4b), the order-panel column of the
 * workspace: name, rule chips with inline parameters, size, a leverage
 * slider capped at the tightest limit, take profit and stop loss, the
 * live liquidation price and fees per trade, a collapsed Risk section and
 * the Save button. Checker refusals and schema issues sit under the field
 * they belong to, in plain words.
 */
const ENTRY_OPTIONS = [
  { value: "maCross", label: "MA cross" },
  { value: "rsi", label: "RSI" },
  { value: "breakout", label: "Breakout" },
] as const;
const TIERS = [
  { value: "studio", label: "Studio" },
  { value: "studio-plus", label: "Studio+" },
] as const;

const numOr = (v: string, fallback: number) => {
  const n = Number(v);
  return v.trim() === "" || !Number.isFinite(n) ? fallback : n;
};
const optional = (v: string) => (v.trim() === "" ? undefined : Number(v));

function Problem({ text }: { text?: string }) {
  return text ? <p className="text-xs text-rose-400">{text}</p> : null;
}

export interface RulePanelProps {
  draft: Draft;
  dispatch: (a: DraftAction) => void;
  market: Market;
  mid: number | null;
  name: string;
  issues: Record<string, string>;
  risk: RiskResult | null;
  costs: TradeCosts;
  liquidationPrice: number | null;
  cap: LeverageCap;
  dirty: boolean;
  saving: boolean;
  saveError: string | null;
  saveRefusals: RiskFinding[];
  onSave: () => void;
  paper: { status: "draft" | "paper" | "live"; since: number | null };
  onStart: () => void;
  onStop: () => void;
  toggling: boolean;
  paperNote: string | null;
}

export function RulePanel(p: RulePanelProps) {
  const { draft, dispatch, market, name, issues, risk, costs, cap } = p;
  const refusals = [...(risk?.refusals ?? []), ...p.saveRefusals];
  const at = (slot: ReturnType<typeof refusalSlot>) =>
    refusals
      .filter((f) => refusalSlot(f.code) === slot)
      .map((f) => f.message)
      .join(" ") || undefined;
  const blocking = refusals.some((f) => refusalSlot(f.code) !== "market" && refusalSlot(f.code) !== "note");
  const onPaper = p.paper.status === "paper";
  const canSave = p.dirty && Object.keys(issues).length === 0 && !blocking && !p.saving && !onPaper;
  const canStart = Boolean(draft.id) && !p.dirty && Object.keys(issues).length === 0 && !blocking && p.paper.status === "draft" && !p.toggling;
  const entry = draft.entry;
  const notional = draft.size.collateralUsd * draft.size.leverage;
  const capLabel =
    cap.bound === "tier"
      ? `${draft.tier === "studio" ? "Studio" : "Studio+"} limit`
      : cap.bound === "overnight"
        ? `${market.symbol} overnight limit`
        : `${market.symbol} limit`;

  return (
    <div className="flex h-full flex-col text-sm">
      <div className="space-y-4 p-4">
        <Field label="Name" hint={draft.nameTouched ? "Clear to use the generated name" : "Generated from the market and rule"}>
          <Input value={draft.nameTouched ? draft.name : name} onChange={(e) => dispatch({ type: "name", name: e.target.value })} maxLength={60} />
          <Problem text={issues.name} />
        </Field>
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <p className="font-medium text-ink-200">Direction</p>
            <p className="mt-1 text-ink-400">Long</p>
          </div>
          <div>
            <p className="font-medium text-ink-200">Checks</p>
            <p className="mt-1 text-ink-400">Daily close, 00:00 UTC</p>
          </div>
        </div>
      </div>

      <div className="space-y-4 border-t border-ink-700/40 p-4">
        <ChipRadioGroup label="Entry" value={entry.kind} onChange={(v) => v && dispatch({ type: "entryKind", kind: v })} options={ENTRY_OPTIONS} />
        {entry.kind === "maCross" ? (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Fast, bars">
              <Input inputMode="numeric" value={String(entry.fast)} onChange={(e) => dispatch({ type: "entryParam", patch: { fast: numOr(e.target.value, 0) } })} />
            </Field>
            <Field label="Slow, bars">
              <Input inputMode="numeric" value={String(entry.slow)} onChange={(e) => dispatch({ type: "entryParam", patch: { slow: numOr(e.target.value, 0) } })} />
            </Field>
          </div>
        ) : entry.kind === "rsi" ? (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Period, bars">
              <Input inputMode="numeric" value={String(entry.period)} onChange={(e) => dispatch({ type: "entryParam", patch: { period: numOr(e.target.value, 0) } })} />
            </Field>
            <Field label="Buy above" hint={`Sell below ${100 - entry.buyBelow}`}>
              <Input inputMode="numeric" value={String(entry.buyBelow)} onChange={(e) => dispatch({ type: "entryParam", patch: { buyBelow: numOr(e.target.value, 0) } })} />
            </Field>
          </div>
        ) : (
          <Field label="Lookback, bars" hint="Buy above the high, sell below the low">
            <Input inputMode="numeric" value={String(entry.lookback)} onChange={(e) => dispatch({ type: "entryParam", patch: { lookback: numOr(e.target.value, 0) } })} />
          </Field>
        )}
        <Problem text={issues["entry.fast"] ?? issues["entry.slow"] ?? issues["entry.period"] ?? issues["entry.buyBelow"] ?? issues["entry.lookback"] ?? issues.entry} />
        <p className="text-xs text-ink-500">Exits on the opposite signal, or at the levels below.</p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Take profit, %">
            <Input inputMode="decimal" value={draft.exit.takeProfitPct ?? ""} onChange={(e) => dispatch({ type: "exit", patch: { takeProfitPct: optional(e.target.value) } })} placeholder="off" />
          </Field>
          <Field label="Stop loss, %">
            <Input inputMode="decimal" value={draft.exit.stopLossPct ?? ""} onChange={(e) => dispatch({ type: "exit", patch: { stopLossPct: optional(e.target.value) } })} placeholder="off" />
          </Field>
        </div>
        <Problem text={issues["exit.takeProfitPct"] ?? issues["exit.stopLossPct"]} />
      </div>

      <div className="space-y-4 border-t border-ink-700/40 p-4">
        <Field label="Size, USDC" hint={`${formatUsd(notional, 0)} notional at ${draft.size.leverage}x`}>
          <Input inputMode="decimal" value={String(draft.size.collateralUsd)} onChange={(e) => dispatch({ type: "size", patch: { collateralUsd: numOr(e.target.value, 0) } })} />
          <Problem text={at("size") ?? issues["size.collateralUsd"]} />
        </Field>
        <div className="space-y-1.5">
          <div className="flex items-baseline justify-between">
            <span className="text-xs font-medium text-ink-200">Leverage</span>
            <span className="text-xs tabular-nums text-ink-100">{draft.size.leverage}x</span>
          </div>
          <input
            type="range"
            min={1}
            max={Math.max(1, cap.cap)}
            step={0.5}
            value={draft.size.leverage}
            onChange={(e) => dispatch({ type: "size", patch: { leverage: Number(e.target.value) } })}
            className="w-full accent-electric-500"
            aria-label="Leverage"
          />
          <p className="text-xs text-ink-500">
            Cap {cap.cap}x, {capLabel}
          </p>
          <Problem text={at("leverage") ?? issues["size.leverage"]} />
        </div>
        <dl className="space-y-1 text-xs">
          <div className="flex justify-between gap-3">
            <dt className="text-ink-500">Liquidation</dt>
            <dd className="tabular-nums text-ink-100">{p.liquidationPrice ? formatPrice(p.liquidationPrice) : "–"}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-ink-500">Fees per round trip</dt>
            <dd className="tabular-nums text-ink-100">{formatUsd(costs.openFee + 2 * costs.oracleFee, 2)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-ink-500">Rollover per day</dt>
            <dd className="tabular-nums text-ink-100">
              {costs.rolloverPerDay < 0 ? "−" : ""}
              {formatUsd(Math.abs(costs.rolloverPerDay), 4)}
            </dd>
          </div>
        </dl>
      </div>

      <details className="group border-t border-ink-700/40">
        <summary className="flex cursor-pointer items-center justify-between px-4 py-3 text-xs font-medium text-ink-200">
          Risk
          <span className="text-ink-500">
            {formatUsd(draft.caps.maxPositionUsd, 0)} max · {draft.caps.dailyLossLimitUsd ? `${formatUsd(draft.caps.dailyLossLimitUsd, 0)} daily stop` : "no daily stop"}
          </span>
        </summary>
        <div className="space-y-4 px-4 pb-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Max position, $" hint={`Limit ${formatUsd(DEFAULT_RISK_LIMITS.maxPositionUsdPerStrategy, 0)}`}>
              <Input inputMode="decimal" value={String(draft.caps.maxPositionUsd)} onChange={(e) => dispatch({ type: "caps", patch: { maxPositionUsd: numOr(e.target.value, 0) } })} />
            </Field>
            <Field label="Daily loss stop, $" hint="0 turns it off">
              <Input inputMode="decimal" value={String(draft.caps.dailyLossLimitUsd)} onChange={(e) => dispatch({ type: "caps", patch: { dailyLossLimitUsd: numOr(e.target.value, 0) } })} />
            </Field>
          </div>
          <Problem text={at("risk") ?? issues["caps.maxPositionUsd"] ?? issues["caps.dailyLossLimitUsd"]} />
          <ChipRadioGroup label="Tier" value={draft.tier} onChange={(v) => v && dispatch({ type: "tier", tier: v as Tier, leverageCap: cap.cap })} options={TIERS} hint="Studio 5x, Studio+ 15x, or the market's own limit when lower." />
        </div>
      </details>

      <div className="mt-auto space-y-2 border-t border-ink-700/40 p-4">
        {p.saveError ? <p className="text-xs text-rose-400">{p.saveError}</p> : null}
        {p.paperNote ? <p className="text-xs text-ink-300">{p.paperNote}</p> : null}
        {onPaper ? (
          <Button type="button" variant="secondary" className="w-full" disabled={p.toggling} onClick={p.onStop}>
            {p.toggling ? "Stopping…" : "Stop paper trading"}
          </Button>
        ) : (
          <>
            <Button type="button" className="w-full" disabled={!canSave} onClick={p.onSave}>
              {p.saving ? "Saving…" : draft.id ? "Save changes" : "Save strategy"}
            </Button>
            <Button type="button" variant="secondary" className="w-full" disabled={!canStart} onClick={p.onStart}>
              {p.toggling ? "Starting…" : "Start paper trading"}
            </Button>
          </>
        )}
        <p className="text-center text-[11px] text-ink-500">
          {onPaper
            ? `Paper since ${p.paper.since ? new Date(p.paper.since).toISOString().slice(0, 10) : "today"} · stop to edit`
            : p.dirty
              ? "Unsaved changes · save before starting paper trading"
              : draft.id
                ? "Saved · paper trades at the live Ostium price, no wallet"
                : "Not saved yet"}
        </p>
      </div>
    </div>
  );
}

export type { EntryRule };
