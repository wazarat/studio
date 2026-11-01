"use server";

import { z } from "zod";

import type { PriceComparison } from "@/lib/chainlink/compare";
import { referenceFor, toleranceBps } from "@/lib/chainlink/read";
import { requireInternalAdmin } from "@/lib/auth";
import { checkRisk, type RiskResult, type StrategyRiskState, type Tier } from "@/lib/risk/check";
import { getDevSigner } from "@/lib/signers/dev";
import {
  findOrdersByTxHash,
  getApproveUsdcTx,
  getBalances,
  getFills,
  getRolloverHistory,
  isTestnet,
  ostium,
  type FillRow,
  type OrderStatus,
  type RolloverPoint,
  type WalletBalances,
} from "@/lib/venues/ostium";
import type { CloseIntent, Hex, OpenIntent, Position, PreviewResult, UpdateIntent } from "@/lib/venues/types";

/**
 * Server actions behind the internal Ostium page. Each one checks the
 * allowlist first (actions are public endpoints), returns only JSON-safe
 * values, and reports failures as `{ error }` rather than throwing, so the
 * page can show them as sentences. The dev actions build through the venue
 * layer, run the risk checker, and only then hand the transaction to the
 * testnet signer; a refusal never reaches the signer.
 */

type Result<T> = ({ ok: true } & T) | { ok: false; error: string };

const hex = z.string().regex(/^0x[0-9a-fA-F]+$/) as unknown as z.ZodType<Hex>;

const OpenIntentSchema = z.object({
  marketId: z.string().min(1),
  side: z.enum(["long", "short"]),
  collateralUsd: z.number().positive().max(1_000_000),
  leverage: z.number().positive().max(500),
  orderType: z.enum(["market", "limit", "stop"]),
  limitPrice: z.number().positive().optional(),
  takeProfit: z.number().positive().optional(),
  stopLoss: z.number().positive().optional(),
  slippageBps: z.number().min(0).max(1_000).optional(),
  isDayTrade: z.boolean().optional(),
}) satisfies z.ZodType<OpenIntent>;

const StrategySchema = z.object({
  strategyId: z.string().min(1),
  openNotionalUsd: z.number().min(0),
  dailyLossLimitUsd: z.number().min(0),
  lossTodayUsd: z.number().min(0),
}) satisfies z.ZodType<StrategyRiskState>;

const TierSchema = z.enum(["studio", "studio-plus"]) satisfies z.ZodType<Tier>;

function fail(error: unknown): { ok: false; error: string } {
  return { ok: false, error: error instanceof Error ? error.message : String(error) };
}

async function guarded<T>(fn: () => Promise<T>): Promise<Result<T>> {
  try {
    await requireInternalAdmin();
    return { ok: true, ...(await fn()) };
  } catch (error) {
    return fail(error);
  }
}

export interface PreviewOutcome {
  preview: PreviewResult;
  risk: RiskResult;
  reference: PriceComparison | null;
}

async function previewAndCheck(intentRaw: unknown, tierRaw: unknown, strategyRaw: unknown): Promise<PreviewOutcome> {
  const intent = OpenIntentSchema.parse(intentRaw);
  const tier = TierSchema.parse(tierRaw);
  const strategy = StrategySchema.parse(strategyRaw);
  const market = (await ostium.markets()).find((m) => m.id === intent.marketId);
  if (!market) throw new Error(`Unknown market ${intent.marketId}`);
  const preview = await ostium.previewOpen(intent);
  const reference = await referenceFor(market.symbol, preview.midPrice);
  const risk = checkRisk({
    kind: "open",
    tier,
    testnet: isTestnet(),
    intent,
    market,
    sizeUsd: preview.sizeUsd,
    strategy,
    reference,
    limits: { referenceToleranceBps: toleranceBps() },
  });
  return { preview, risk, reference };
}

export async function previewAction(intent: OpenIntent, tier: Tier, strategy: StrategyRiskState) {
  return guarded(() => previewAndCheck(intent, tier, strategy));
}

export async function rolloverAction(marketId: string): Promise<Result<{ points: RolloverPoint[] }>> {
  return guarded(async () => {
    const points = await getRolloverHistory(z.string().min(1).parse(marketId), Date.now() - 24 * 60 * 60 * 1000);
    return { points };
  });
}

/* ---------- testnet trades through the dev signer ---------- */

function signerOrThrow() {
  const signer = getDevSigner();
  if (!signer) throw new Error("No dev signer: set OSTIUM_DEV_PRIVATE_KEY in .env.local.");
  return signer;
}

export async function devWalletAction(): Promise<
  Result<{ address: Hex; balances: WalletBalances; positions: Position[]; fills: FillRow[] }>
> {
  return guarded(async () => {
    const signer = signerOrThrow();
    const [balances, positions, fills] = await Promise.all([
      getBalances(signer.address),
      ostium.positions(signer.address),
      getFills(signer.address, 25),
    ]);
    return { address: signer.address, balances, positions, fills };
  });
}

export async function devApproveAction(amountUsd: number): Promise<Result<{ hash: Hex }>> {
  return guarded(async () => {
    const signer = signerOrThrow();
    const tx = await getApproveUsdcTx(signer.address, z.number().positive().max(10_000).parse(amountUsd));
    return signer.send(tx);
  });
}

export async function devOpenAction(
  intent: OpenIntent,
  tier: Tier,
  strategy: StrategyRiskState,
): Promise<Result<{ hash: Hex | null; outcome: PreviewOutcome }>> {
  return guarded(async () => {
    const signer = signerOrThrow();
    const outcome = await previewAndCheck(intent, tier, strategy);
    if (!outcome.risk.ok) return { hash: null, outcome };
    const tx = await ostium.buildOpen(signer.address, OpenIntentSchema.parse(intent));
    const { hash } = await signer.send(tx);
    return { hash, outcome };
  });
}

export async function devCloseAction(intent: CloseIntent): Promise<Result<{ hash: Hex }>> {
  return guarded(async () => {
    const signer = signerOrThrow();
    const parsed = z
      .object({ marketId: z.string().min(1), index: z.number().int().min(0), closePercent: z.number().min(1).max(100) })
      .parse(intent);
    // Closes always pass the checker; it is called so the rule is visible.
    checkRisk({ kind: "close" });
    const tx = await ostium.buildClose(signer.address, parsed);
    return signer.send(tx);
  });
}

export async function devUpdateAction(intent: UpdateIntent): Promise<Result<{ hashes: Hex[] }>> {
  return guarded(async () => {
    const signer = signerOrThrow();
    const parsed = z
      .object({
        marketId: z.string().min(1),
        index: z.number().int().min(0),
        takeProfit: z.number().positive().nullable().optional(),
        stopLoss: z.number().positive().nullable().optional(),
        collateralDeltaUsd: z.number().optional(),
      })
      .parse(intent);
    const txs = await ostium.buildUpdate(signer.address, parsed);
    const hashes: Hex[] = [];
    for (const tx of txs) hashes.push((await signer.send(tx)).hash);
    return { hashes };
  });
}

export async function devStatusAction(hash: Hex): Promise<Result<{ orders: OrderStatus[] }>> {
  return guarded(async () => ({ orders: await findOrdersByTxHash(hex.parse(hash)) }));
}
