import { z } from "zod";

/**
 * The strategy object (Studio step 4): one typed, validated spec that the
 * form produces, the database stores as jsonb, and the backtest engine and
 * the bot read. Long only for now, but `direction` is stored so shorts can
 * arrive without a migration. Leverage and notional caps are not checked
 * here on purpose: lib/risk/check.ts owns them, so a strategy over a cap is
 * refused by the checker with the same code the bot would see.
 */

export const EntryRuleSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("maCross"),
    fast: z.number().int().min(2).max(200),
    slow: z.number().int().min(3).max(400),
  }),
  z.object({
    kind: z.literal("rsi"),
    period: z.number().int().min(2).max(100),
    buyBelow: z.number().min(1).max(49),
  }),
  z.object({
    kind: z.literal("breakout"),
    lookback: z.number().int().min(2).max(400),
  }),
]);

export const StrategySpecSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().trim().min(1).max(60),
    market: z.object({
      venue: z.literal("ostium"),
      marketId: z.string().min(1),
      symbol: z.string().min(1),
    }),
    /** Stored as the enum; only "long" is accepted this step. */
    direction: z.enum(["long", "short"]),
    entry: EntryRuleSchema,
    /** The position always exits on the opposite signal; these are extra, in percent of the entry price. */
    exit: z.object({
      takeProfitPct: z.number().positive().max(1_000).optional(),
      stopLossPct: z.number().positive().max(100).optional(),
    }),
    size: z.object({
      collateralUsd: z.number().positive(),
      leverage: z.number().min(1).max(100),
    }),
    wake: z.object({ kind: z.literal("candle-close"), resolution: z.literal("1D") }),
    caps: z.object({
      maxPositionUsd: z.number().positive().max(1_000),
      dailyLossLimitUsd: z.number().min(0),
    }),
    tier: z.enum(["studio", "studio-plus"]),
    status: z.enum(["draft", "paper", "live"]),
  })
  .superRefine((s, ctx) => {
    if (s.direction !== "long") {
      ctx.addIssue({ code: "custom", path: ["direction"], message: "Only long strategies are available for now." });
    }
    if (s.entry.kind === "maCross" && s.entry.fast >= s.entry.slow) {
      ctx.addIssue({ code: "custom", path: ["entry", "fast"], message: "The fast average must be shorter than the slow one." });
    }
    const sl = s.exit.stopLossPct;
    if (sl !== undefined && sl / 100 >= LIQUIDATION_LOSS_FRACTION / s.size.leverage) {
      ctx.addIssue({
        code: "custom",
        path: ["exit", "stopLossPct"],
        message: `A ${sl}% stop is past the liquidation price at ${s.size.leverage}x.`,
      });
    }
  });

export type StrategySpec = z.infer<typeof StrategySpecSchema>;
export type EntryRule = StrategySpec["entry"];

/** Share of collateral lost at liquidation, the approximation the engine uses. */
export const LIQUIDATION_LOSS_FRACTION = 0.9;

/** Candles consumed before the first signal can be evaluated. */
export function warmupCandles(entry: EntryRule): number {
  switch (entry.kind) {
    case "maCross":
      return entry.slow;
    case "rsi":
      return entry.period + 1;
    case "breakout":
      return entry.lookback;
  }
}

export function describeEntry(entry: EntryRule): string {
  switch (entry.kind) {
    case "maCross":
      return `MA cross ${entry.fast}/${entry.slow}`;
    case "rsi":
      return `RSI ${entry.period} below ${entry.buyBelow}`;
    case "breakout":
      return `Breakout ${entry.lookback}d`;
  }
}
