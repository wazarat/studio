import { describe, expect, it } from "vitest";

import { clampLeverage, draftFromSpec, draftReducer, generatedName, leverageCap, newDraft, refusalSlot, toSpec } from "@/lib/strategies/draft";
import { StrategySpecSchema } from "@/lib/strategies/spec";

const limits = (maxLeverage: number, overnightMaxLeverage: number) => ({
  limits: { minNotionalUsd: 5, maxNotionalLongUsd: 1e6, maxNotionalShortUsd: 1e6, minLeverage: 1, maxLeverage, overnightMaxLeverage },
});

describe("generatedName", () => {
  it("names by base asset and rule", () => {
    expect(generatedName("BTC/USD", { kind: "maCross", fast: 10, slow: 30 })).toBe("BTC MA 10/30");
    expect(generatedName("XAU/USD", { kind: "breakout", lookback: 20 })).toBe("XAU breakout 20");
    expect(generatedName("NVDA/USD", { kind: "rsi", period: 14, buyBelow: 30 })).toBe("NVDA RSI 14/30");
  });
});

describe("leverageCap", () => {
  it("picks the tightest bound and names it", () => {
    expect(leverageCap(limits(50, 0), "studio")).toEqual({ cap: 5, bound: "tier" });
    expect(leverageCap(limits(50, 0), "studio-plus")).toEqual({ cap: 15, bound: "tier" });
    expect(leverageCap(limits(3, 0), "studio")).toEqual({ cap: 3, bound: "market" });
    expect(leverageCap(limits(100, 10), "studio-plus")).toEqual({ cap: 10, bound: "overnight" });
    expect(leverageCap(limits(100, 5), "studio")).toEqual({ cap: 5, bound: "tier" });
  });
});

describe("draftReducer", () => {
  it("keeps the rule and clamps leverage when the market changes", () => {
    const d = { ...newDraft("0"), entry: { kind: "rsi" as const, period: 7, buyBelow: 25 }, size: { collateralUsd: 50, leverage: 5 } };
    const next = draftReducer(d, { type: "market", marketId: "18", leverageCap: 3 });
    expect(next.marketId).toBe("18");
    expect(next.entry).toEqual(d.entry);
    expect(next.size.leverage).toBe(3);
  });

  it("swaps to the rule's defaults only when the kind changes", () => {
    const d = newDraft("0");
    expect(draftReducer(d, { type: "entryKind", kind: "maCross" })).toBe(d);
    expect(draftReducer(d, { type: "entryKind", kind: "breakout" }).entry).toEqual({ kind: "breakout", lookback: 20 });
  });

  it("an emptied name goes back to the generated one", () => {
    const d = draftReducer(newDraft("0"), { type: "name", name: "My own" });
    expect(d.nameTouched).toBe(true);
    expect(draftReducer(d, { type: "name", name: "  " }).nameTouched).toBe(false);
  });

  it("steps leverage by halves inside 1 and the cap", () => {
    expect(clampLeverage(2.3, 5)).toBe(2.5);
    expect(clampLeverage(9, 5)).toBe(5);
    expect(clampLeverage(0.2, 5)).toBe(1);
  });
});

describe("toSpec and draftFromSpec", () => {
  it("round-trips through the schema", () => {
    const draft = newDraft("0", { exit: { stopLossPct: 8 } });
    const spec = StrategySpecSchema.parse({ ...toSpec(draft, { id: "0", symbol: "BTC/USD" }, "BTC MA 10/30"), id: "11111111-1111-1111-1111-111111111111" });
    expect(spec.direction).toBe("long");
    expect(spec.exit).toEqual({ stopLossPct: 8 });
    const back = draftFromSpec(spec);
    expect(back.nameTouched).toBe(false);
    expect(back.entry).toEqual(draft.entry);
    expect(back.id).toBe(spec.id);
  });

  it("treats a zero take profit as unset", () => {
    const spec = toSpec(newDraft("0", { exit: { takeProfitPct: 0 } }), { id: "0", symbol: "BTC/USD" }, "x");
    expect(spec.exit.takeProfitPct).toBeUndefined();
  });
});

describe("refusalSlot", () => {
  it("sends each checker code to its field", () => {
    expect(refusalSlot("leverage-over-tier")).toBe("leverage");
    expect(refusalSlot("size-over-oi-share")).toBe("size");
    expect(refusalSlot("daily-loss-stop")).toBe("risk");
    expect(refusalSlot("market-closed")).toBe("market");
    expect(refusalSlot("reference-missing")).toBe("note");
  });
});
