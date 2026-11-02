import "server-only";

import { getDb } from "@/lib/db";
import type { NewProposal, Proposal, ProposalKind, ProposalStatus } from "@/lib/proposals/types";
import type { BacktestResult } from "@/lib/strategies/backtest";
import { StrategySpecSchema } from "@/lib/strategies/spec";

/** Proposals in Neon (step 6), owner-scoped like everything else. */

function toProposal(r: Record<string, unknown>): Proposal {
  return {
    id: String(r.id),
    strategyId: String(r.strategy_id),
    ownerId: String(r.owner_id),
    kind: r.kind as ProposalKind,
    proposedSpec: r.proposed_spec ? StrategySpecSchema.parse(r.proposed_spec) : null,
    reason: String(r.reason ?? ""),
    backtest: (r.backtest as BacktestResult | null) ?? null,
    clientId: r.client_id ? String(r.client_id) : null,
    clientName: r.client_name ? String(r.client_name) : null,
    status: r.status as ProposalStatus,
    createdAt: new Date(r.created_at as string).getTime(),
    decidedAt: r.decided_at ? new Date(r.decided_at as string).getTime() : null,
  };
}

function sqlOrThrow() {
  const sql = getDb();
  if (!sql) throw new Error("Storage not configured");
  return sql;
}

export async function insertProposal(p: NewProposal): Promise<Proposal> {
  const sql = sqlOrThrow();
  const rows = await sql`
    insert into studio.proposals (strategy_id, owner_id, kind, proposed_spec, reason, backtest, client_id, client_name)
    values (${p.strategyId}, ${p.ownerId}, ${p.kind}, ${p.proposedSpec ? JSON.stringify(p.proposedSpec) : null}, ${p.reason},
            ${p.backtest ? JSON.stringify(p.backtest) : null}, ${p.clientId}, ${p.clientName})
    returning *`;
  return toProposal(rows[0]);
}

export async function pendingProposals(strategyId: string): Promise<Proposal[]> {
  const sql = getDb();
  if (!sql) return [];
  const rows = await sql`select * from studio.proposals where strategy_id = ${strategyId} and status = 'pending' order by created_at asc`;
  return rows.map(toProposal);
}

export async function proposalsForOwner(ownerId: string, strategyId?: string, limit = 50): Promise<Proposal[]> {
  const sql = getDb();
  if (!sql) return [];
  const rows = strategyId
    ? await sql`select * from studio.proposals where owner_id = ${ownerId} and strategy_id = ${strategyId} order by created_at desc limit ${limit}`
    : await sql`select * from studio.proposals where owner_id = ${ownerId} order by created_at desc limit ${limit}`;
  return rows.map(toProposal);
}

export async function getProposal(id: string, ownerId: string): Promise<Proposal | null> {
  const sql = getDb();
  if (!sql) return null;
  const rows = await sql`select * from studio.proposals where id = ${id} and owner_id = ${ownerId}`;
  return rows[0] ? toProposal(rows[0]) : null;
}

/** Wins only while the proposal is still pending. */
export async function markDecided(id: string, ownerId: string, status: "accepted" | "rejected"): Promise<Proposal | null> {
  const sql = sqlOrThrow();
  const rows = await sql`
    update studio.proposals set status = ${status}, decided_at = now()
    where id = ${id} and owner_id = ${ownerId} and status = 'pending'
    returning *`;
  return rows[0] ? toProposal(rows[0]) : null;
}

/** The feed row for a decision. */
export async function recordAgentActivity(args: { strategyId: string; ownerId: string; reason: string; meta?: Record<string, unknown> }): Promise<void> {
  const sql = sqlOrThrow();
  await sql`
    insert into studio.activity (strategy_id, owner_id, mode, kind, reason, meta, time)
    values (${args.strategyId}, ${args.ownerId}, 'agent', 'proposal', ${args.reason}, ${args.meta ? JSON.stringify(args.meta) : null}, now())`;
}
