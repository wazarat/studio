import type { Proposal } from "@/lib/proposals/types";
import type { StrategySpec } from "@/lib/strategies/spec";

/**
 * What accepting or rejecting a proposal means (step 6), as a pure
 * decision so it is testable: only the user's action applies anything,
 * only a pending proposal can be decided, and a change lands only on a
 * draft.
 */
export type Decision =
  | { ok: true; action: "reject" }
  | { ok: true; action: "apply-change"; spec: StrategySpec }
  | { ok: true; action: "paper-start" }
  | { ok: true; action: "paper-stop" }
  | { ok: false; error: string };

export function decideProposal(proposal: Proposal, strategyStatus: StrategySpec["status"], action: "accept" | "reject"): Decision {
  if (proposal.status !== "pending") return { ok: false, error: `This proposal was already ${proposal.status}.` };
  if (action === "reject") return { ok: true, action: "reject" };
  switch (proposal.kind) {
    case "change":
      if (!proposal.proposedSpec) return { ok: false, error: "The proposal carries no strategy." };
      if (strategyStatus !== "draft") return { ok: false, error: "Stop paper trading before accepting a change to the strategy." };
      return { ok: true, action: "apply-change", spec: { ...proposal.proposedSpec, id: proposal.strategyId, status: "draft" } };
    case "paper-start":
      if (strategyStatus !== "draft") return { ok: false, error: `The strategy is already ${strategyStatus}.` };
      return { ok: true, action: "paper-start" };
    case "paper-stop":
      if (strategyStatus !== "paper") return { ok: false, error: "The strategy is not on paper." };
      return { ok: true, action: "paper-stop" };
  }
}

/** The fields a change touches, in the panel's words, for the card and the feed. */
export function specDiff(current: StrategySpec, proposed: StrategySpec): { field: string; from: string; to: string }[] {
  const out: { field: string; from: string; to: string }[] = [];
  const show = (v: unknown) => (v === undefined || v === null ? "off" : typeof v === "object" ? JSON.stringify(v) : String(v));
  const pairs: [string, unknown, unknown][] = [
    ["Name", current.name, proposed.name],
    ["Market", current.market.symbol, proposed.market.symbol],
    ["Entry", current.entry, proposed.entry],
    ["Take profit, %", current.exit.takeProfitPct, proposed.exit.takeProfitPct],
    ["Stop loss, %", current.exit.stopLossPct, proposed.exit.stopLossPct],
    ["Collateral, USDC", current.size.collateralUsd, proposed.size.collateralUsd],
    ["Leverage", current.size.leverage, proposed.size.leverage],
    ["Max position, $", current.caps.maxPositionUsd, proposed.caps.maxPositionUsd],
    ["Daily loss stop, $", current.caps.dailyLossLimitUsd, proposed.caps.dailyLossLimitUsd],
    ["Tier", current.tier, proposed.tier],
  ];
  for (const [field, a, b] of pairs) {
    if (JSON.stringify(a ?? null) !== JSON.stringify(b ?? null)) out.push({ field, from: show(a), to: show(b) });
  }
  return out;
}
