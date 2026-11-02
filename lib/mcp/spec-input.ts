import { z } from "zod";

import { EntryRuleSchema, StrategySpecSchema, type StrategySpec } from "@/lib/strategies/spec";

/**
 * What an agent sends to describe a strategy (step 6): the stored spec
 * minus id and status, with descriptions the client shows. The server
 * fills the rest and validates with the same schema the form uses.
 */
export const SpecInputSchema = z.object({
  name: z.string().trim().min(1).max(60).optional().describe("Up to 60 characters. Generated from the market and rule when omitted."),
  marketId: z.string().min(1).describe("The market id from list_markets."),
  entry: EntryRuleSchema.describe("One rule: maCross {fast, slow}, rsi {period, buyBelow} or breakout {lookback}. Exits on the opposite signal."),
  takeProfitPct: z.number().positive().max(1000).optional().describe("Percent of the entry price."),
  stopLossPct: z.number().positive().max(100).optional().describe("Percent of the entry price, inside the liquidation distance."),
  collateralUsd: z.number().positive().describe("USDC put up per trade."),
  leverage: z.number().min(1).max(100).describe("Studio allows up to 5x, Studio+ up to 15x, or the market's own limit when lower."),
  maxPositionUsd: z.number().positive().max(1000).optional().describe("Open notional cap per strategy, at most 1000. Default 1000."),
  dailyLossLimitUsd: z.number().min(0).optional().describe("Daily loss stop in USD, 0 turns it off. Default 50."),
  tier: z.enum(["studio", "studio-plus"]).optional().describe("Default studio."),
});

export type SpecInput = z.infer<typeof SpecInputSchema>;

export const SpecPatchSchema = SpecInputSchema.partial().describe("Only the fields that change.");
export type SpecPatch = z.infer<typeof SpecPatchSchema>;

function baseName(symbol: string, entry: SpecInput["entry"]): string {
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

/** The full spec from an input, for a market the caller has already resolved. */
export function specFromInput(input: SpecInput, market: { id: string; symbol: string }, id: string, status: StrategySpec["status"] = "draft"): StrategySpec {
  return StrategySpecSchema.parse({
    id,
    name: input.name ?? baseName(market.symbol, input.entry),
    market: { venue: "ostium", marketId: market.id, symbol: market.symbol },
    direction: "long",
    entry: input.entry,
    exit: { takeProfitPct: input.takeProfitPct, stopLossPct: input.stopLossPct },
    size: { collateralUsd: input.collateralUsd, leverage: input.leverage },
    wake: { kind: "candle-close", resolution: "1D" },
    caps: { maxPositionUsd: input.maxPositionUsd ?? 1000, dailyLossLimitUsd: input.dailyLossLimitUsd ?? 50 },
    tier: input.tier ?? "studio",
    status,
  });
}

/** The input shape of a stored spec, so a patch can be merged onto it. */
export function inputFromSpec(spec: StrategySpec): SpecInput {
  return {
    name: spec.name,
    marketId: spec.market.marketId,
    entry: spec.entry,
    takeProfitPct: spec.exit.takeProfitPct,
    stopLossPct: spec.exit.stopLossPct,
    collateralUsd: spec.size.collateralUsd,
    leverage: spec.size.leverage,
    maxPositionUsd: spec.caps.maxPositionUsd,
    dailyLossLimitUsd: spec.caps.dailyLossLimitUsd,
    tier: spec.tier,
  };
}

/** Applies a patch; undefined fields in the patch leave the current value alone. */
export function applyPatch(current: SpecInput, patch: SpecPatch): SpecInput {
  const out: SpecInput = { ...current };
  for (const [k, v] of Object.entries(patch)) {
    if (v !== undefined) (out as Record<string, unknown>)[k] = v;
  }
  return out;
}
