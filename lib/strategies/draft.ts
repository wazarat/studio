import { DEFAULT_RISK_LIMITS, type RiskCode, type Tier } from "@/lib/risk/check";
import type { EntryRule, StrategySpec } from "@/lib/strategies/spec";
import type { Market } from "@/lib/venues/types";

/**
 * The workspace draft (Studio step 4b): what the panel edits before it
 * becomes a validated StrategySpec. Pure, so the reducer and helpers run
 * in the browser and in tests. The spec stays the one stored shape;
 * `toSpec` is the only way out of here.
 */

export interface Draft {
  id: string | null;
  /** Empty means "use the generated name". */
  name: string;
  nameTouched: boolean;
  marketId: string;
  entry: EntryRule;
  exit: { takeProfitPct?: number; stopLossPct?: number };
  size: { collateralUsd: number; leverage: number };
  caps: { maxPositionUsd: number; dailyLossLimitUsd: number };
  tier: Tier;
  status: StrategySpec["status"];
}

export const DEFAULT_ENTRY: Record<EntryRule["kind"], EntryRule> = {
  maCross: { kind: "maCross", fast: 10, slow: 30 },
  rsi: { kind: "rsi", period: 14, buyBelow: 30 },
  breakout: { kind: "breakout", lookback: 20 },
};
export const DEFAULT_SIZE = { collateralUsd: 100, leverage: 2 } as const;
export const DEFAULT_CAPS = { maxPositionUsd: 1000, dailyLossLimitUsd: 50 } as const;

export type DraftAction =
  | { type: "market"; marketId: string; leverageCap: number }
  | { type: "entryKind"; kind: EntryRule["kind"] }
  | { type: "entryParam"; patch: Record<string, number> }
  | { type: "exit"; patch: Partial<Draft["exit"]> }
  | { type: "size"; patch: Partial<Draft["size"]> }
  | { type: "caps"; patch: Partial<Draft["caps"]> }
  | { type: "tier"; tier: Tier; leverageCap: number }
  | { type: "name"; name: string }
  | { type: "saved"; id: string }
  | { type: "status"; status: Draft["status"] };

/** Leverage on a 0.5 grid, never above the cap, never below 1. */
export function clampLeverage(leverage: number, cap: number): number {
  const stepped = Math.round(leverage * 2) / 2;
  return Math.max(1, Math.min(stepped, cap));
}

export function draftReducer(d: Draft, a: DraftAction): Draft {
  switch (a.type) {
    case "market":
      return { ...d, marketId: a.marketId, size: { ...d.size, leverage: clampLeverage(d.size.leverage, a.leverageCap) } };
    case "entryKind":
      return d.entry.kind === a.kind ? d : { ...d, entry: DEFAULT_ENTRY[a.kind] };
    case "entryParam":
      return { ...d, entry: { ...d.entry, ...a.patch } as EntryRule };
    case "exit":
      return { ...d, exit: { ...d.exit, ...a.patch } };
    case "size":
      return { ...d, size: { ...d.size, ...a.patch } };
    case "caps":
      return { ...d, caps: { ...d.caps, ...a.patch } };
    case "tier":
      return { ...d, tier: a.tier, size: { ...d.size, leverage: clampLeverage(d.size.leverage, a.leverageCap) } };
    case "name":
      return a.name.trim() === "" ? { ...d, name: "", nameTouched: false } : { ...d, name: a.name, nameTouched: true };
    case "saved":
      return { ...d, id: a.id };
    case "status":
      return { ...d, status: a.status };
  }
}

export function newDraft(marketId: string, overrides: Partial<Draft> = {}): Draft {
  return {
    id: null,
    name: "",
    nameTouched: false,
    marketId,
    entry: DEFAULT_ENTRY.maCross,
    exit: {},
    size: { ...DEFAULT_SIZE },
    caps: { ...DEFAULT_CAPS },
    tier: "studio",
    status: "draft",
    ...overrides,
  };
}

export function draftFromSpec(spec: StrategySpec): Draft {
  return {
    id: spec.id,
    name: spec.name,
    nameTouched: spec.name !== generatedName(spec.market.symbol, spec.entry),
    marketId: spec.market.marketId,
    entry: spec.entry,
    exit: { ...spec.exit },
    size: { ...spec.size },
    caps: { ...spec.caps },
    tier: spec.tier,
    status: spec.status,
  };
}

/** The unvalidated spec object for the schema; `id` is "preview" until saved. */
export function toSpec(draft: Draft, market: Pick<Market, "id" | "symbol">, name: string): StrategySpec {
  return {
    id: draft.id ?? "preview",
    name,
    market: { venue: "ostium", marketId: market.id, symbol: market.symbol },
    direction: "long",
    entry: draft.entry,
    exit: {
      takeProfitPct: draft.exit.takeProfitPct || undefined,
      stopLossPct: draft.exit.stopLossPct || undefined,
    },
    size: { ...draft.size },
    wake: { kind: "candle-close", resolution: "1D" },
    caps: { ...draft.caps },
    tier: draft.tier,
    status: draft.status,
  };
}

/** "BTC MA 10/30", "XAU breakout 20", "NVDA RSI 14/30". */
export function generatedName(symbol: string, entry: EntryRule): string {
  const base = symbol.split("/")[0] ?? symbol;
  switch (entry.kind) {
    case "maCross":
      return `${base} MA ${entry.fast}/${entry.slow}`;
    case "rsi":
      return `${base} RSI ${entry.period}/${entry.buyBelow}`;
    case "breakout":
      return `${base} breakout ${entry.lookback}`;
  }
}

export interface LeverageCap {
  cap: number;
  bound: "tier" | "market" | "overnight";
}

/** A daily-close strategy holds overnight, so the overnight limit always counts. */
export function leverageCap(market: Pick<Market, "limits">, tier: Tier): LeverageCap {
  const tierCap = DEFAULT_RISK_LIMITS.maxLeverageByTier[tier];
  const marketCap = market.limits.maxLeverage > 0 ? market.limits.maxLeverage : Number.POSITIVE_INFINITY;
  const overnight = market.limits.overnightMaxLeverage > 0 ? market.limits.overnightMaxLeverage : Number.POSITIVE_INFINITY;
  const cap = Math.min(tierCap, marketCap, overnight);
  const bound = cap === tierCap ? "tier" : cap === overnight ? "overnight" : "market";
  return { cap, bound };
}

export type RefusalSlot = "leverage" | "size" | "risk" | "market" | "note";

export function refusalSlot(code: RiskCode): RefusalSlot {
  switch (code) {
    case "leverage-over-tier":
    case "leverage-over-market":
    case "leverage-over-overnight":
      return "leverage";
    case "size-over-strategy-cap":
    case "size-over-oi-share":
      return "size";
    case "daily-loss-stop":
      return "risk";
    case "market-closed":
      return "market";
    default:
      return "note";
  }
}
