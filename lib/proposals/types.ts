import type { BacktestResult } from "@/lib/strategies/backtest";
import type { StrategySpec } from "@/lib/strategies/spec";

/** Agent proposals (step 6): a pending change or paper request the user decides on. */
export type ProposalKind = "change" | "paper-start" | "paper-stop";
export type ProposalStatus = "pending" | "accepted" | "rejected" | "withdrawn";

export interface Proposal {
  id: string;
  strategyId: string;
  ownerId: string;
  kind: ProposalKind;
  proposedSpec: StrategySpec | null;
  reason: string;
  backtest: BacktestResult | null;
  clientId: string | null;
  clientName: string | null;
  status: ProposalStatus;
  createdAt: number;
  decidedAt: number | null;
}

export type NewProposal = Omit<Proposal, "id" | "status" | "createdAt" | "decidedAt">;

export const MAX_PENDING_PER_STRATEGY = 20;
