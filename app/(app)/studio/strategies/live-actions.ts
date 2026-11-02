"use server";

import { auth } from "@clerk/nextjs/server";
import type { Hex } from "viem";
import { z } from "zod";

import { requireInternalAdmin } from "@/lib/auth";
import { topUpSession } from "@/lib/live/gas";
import { neonLiveStore } from "@/lib/live/store-neon";
import { validateTerms } from "@/lib/live/terms";
import { loadLiveView, type LiveView } from "@/lib/live/view";
import { liveEnabled, liveExecutor } from "@/lib/paper/tick";
import { createSessionKey, destroySessionKey } from "@/lib/signers/kms";
import { getStrategy, storageConfigured } from "@/lib/strategies/db";
import { getApproveUsdcTx, getDelegationStatus, getRemoveDelegateTx, getSetDelegateTx } from "@/lib/venues/ostium";
import type { UnsignedTx } from "@/lib/venues/types";

/**
 * Server actions for live trading (Studio step 7). Behind the admin
 * allowlist with the Clerk user as owner. The wallet signs in the browser;
 * these actions only build the trader's transactions, verify on-chain what
 * the wallet did, and move the session and the strategy between states.
 * Nothing here returns or logs a key.
 */

type Result<T> = ({ ok: true } & T) | { ok: false; error: string };

function fail(error: unknown): { ok: false; error: string } {
  return { ok: false, error: error instanceof Error ? error.message : String(error) };
}

async function owner(): Promise<string> {
  await requireInternalAdmin();
  const { userId } = await auth();
  if (!userId) throw new Error("Not signed in");
  if (!storageConfigured()) throw new Error("Storage is not configured: set DATABASE_URL and run npm run db:setup.");
  return userId;
}

const Address = z.string().regex(/^0x[0-9a-fA-F]{40}$/);
const Terms = z.object({ totalCapUsd: z.number().finite(), expiresAtMs: z.number().int() });

async function strategyOf(id: string, ownerId: string) {
  const row = await getStrategy(z.string().uuid().parse(id), ownerId);
  if (!row) throw new Error("Not found");
  return row;
}

function requireLive() {
  if (!liveEnabled()) throw new Error("Live mode is off: it needs OSTIUM_TESTNET=true and AWS KMS configured.");
}

export async function liveStateAction(id: string): Promise<Result<{ view: LiveView }>> {
  try {
    const ownerId = await owner();
    const row = await strategyOf(id, ownerId);
    return { ok: true, view: await loadLiveView(row) };
  } catch (error) {
    return fail(error);
  }
}

/**
 * Step one of going live: the wallet's session (a fresh KMS key when the
 * wallet has none) and the two transactions the trader signs: the USDC
 * approval for the wallet's total, and the delegate when it is not set.
 */
export async function prepareLiveAction(
  id: string,
  trader: string,
  terms: { totalCapUsd: number; expiresAtMs: number },
): Promise<Result<{ sessionAddress: Hex; approveTx: UnsignedTx; approveUsd: number; delegateTx: UnsignedTx | null }>> {
  try {
    requireLive();
    const ownerId = await owner();
    const row = await strategyOf(id, ownerId);
    const t = Terms.parse(terms);
    const traderAddr = Address.parse(trader) as Hex;
    if (row.status === "paper") return { ok: false, error: "Stop paper trading first." };
    const existing = await neonLiveStore.link(row.id);
    if (row.status === "live" && existing && ["active", "paused", "closing"].includes(existing.status)) return { ok: false, error: "The strategy is already live." };
    const problem = validateTerms(row.spec.size.collateralUsd, t.totalCapUsd, t.expiresAtMs, Date.now());
    if (problem) return { ok: false, error: problem };

    let session = await neonLiveStore.sessionForWallet(ownerId, traderAddr);
    if (!session) {
      const key = await createSessionKey(`studio:${ownerId.slice(-8)}:${traderAddr.slice(2, 10)}`);
      session = await neonLiveStore.createSession({ ownerId, trader: traderAddr, sessionAddress: key.address, kmsKeyId: key.keyId, expiresAt: t.expiresAtMs }, Date.now());
    }
    const others = (await neonLiveStore.linksForSession(session.id)).filter((l) => l.strategyId !== row.id && ["active", "paused", "closing"].includes(l.status));
    const approveUsd = others.reduce((a, l) => a + Math.max(0, l.totalCapUsd - l.spentUsd), 0) + t.totalCapUsd;
    const [approveTx, status] = await Promise.all([getApproveUsdcTx(traderAddr, approveUsd), getDelegationStatus(traderAddr, session.sessionAddress)]);
    const delegateTx = status.delegateMatches ? null : await getSetDelegateTx(traderAddr, session.sessionAddress);
    return { ok: true, sessionAddress: session.sessionAddress, approveTx, approveUsd, delegateTx };
  } catch (error) {
    return fail(error);
  }
}

/** Step two: verify the approval and the delegate on-chain, fund the session's gas once, and switch the strategy to live. */
export async function activateLiveAction(
  id: string,
  trader: string,
  terms: { totalCapUsd: number; expiresAtMs: number },
  hashes: { approveTx?: string; delegateTx?: string },
): Promise<Result<{ view: LiveView; note: string }>> {
  try {
    requireLive();
    const ownerId = await owner();
    const row = await strategyOf(id, ownerId);
    const t = Terms.parse(terms);
    const traderAddr = Address.parse(trader) as Hex;
    const problem = validateTerms(row.spec.size.collateralUsd, t.totalCapUsd, t.expiresAtMs, Date.now());
    if (problem) return { ok: false, error: problem };
    const session = await neonLiveStore.sessionForWallet(ownerId, traderAddr);
    if (!session) return { ok: false, error: "No session for this wallet; start again from Go live." };
    const status = await getDelegationStatus(traderAddr, session.sessionAddress, row.spec.size.collateralUsd);
    if (!status.delegateMatches) return { ok: false, error: "The delegate is not set on-chain yet. Confirm the second MetaMask transaction, wait a few seconds and try again." };
    if (status.allowanceUsd < row.spec.size.collateralUsd) {
      return { ok: false, error: `The USDC approval is not confirmed yet ($${status.allowanceUsd.toFixed(2)} approved). Wait a few seconds and try again.` };
    }
    const now = Date.now();
    await neonLiveStore.setSessionStatus(session.id, "active", ["pending", "active", "permission-ended"], now);
    await neonLiveStore.setSessionExpiry(session.id, t.expiresAtMs);
    await neonLiveStore.setSessionTxs(session.id, { approveTx: hashes.approveTx, delegateTx: hashes.delegateTx });
    await neonLiveStore.setDelegateCheck(session.id, now, status.allowanceUsd);
    let note = "Live. The latest closed candle is checked on the next tick, then every daily close.";
    if (!session.gasTopupTx) {
      try {
        const sent = await topUpSession(session.sessionAddress);
        if (sent) await neonLiveStore.setSessionTxs(session.id, { gasTopupTx: sent.hash });
        else note += " No dev wallet is configured, so the session account has no gas yet.";
      } catch (e) {
        note += ` Gas top-up failed: ${e instanceof Error ? e.message : String(e)}.`;
      }
    }
    await neonLiveStore.upsertLink({ strategyId: row.id, sessionId: session.id, ownerId, totalCapUsd: t.totalCapUsd }, now);
    await neonLiveStore.setStrategyLive(row.id, true);
    return { ok: true, view: await loadLiveView(row), note };
  } catch (error) {
    return fail(error);
  }
}

export async function pauseLiveAction(id: string, resume = false): Promise<Result<{ view: LiveView }>> {
  try {
    const ownerId = await owner();
    const row = await strategyOf(id, ownerId);
    const moved = resume
      ? await neonLiveStore.setLinkStatus(row.id, "active", ["paused"], Date.now())
      : await neonLiveStore.setLinkStatus(row.id, "paused", ["active"], Date.now());
    if (!moved) return { ok: false, error: resume ? "Not paused." : "Not active." };
    return { ok: true, view: await loadLiveView(row) };
  } catch (error) {
    return fail(error);
  }
}

export async function closeAllLiveAction(id: string): Promise<Result<{ view: LiveView; note: string }>> {
  try {
    requireLive();
    const ownerId = await owner();
    const row = await strategyOf(id, ownerId);
    const ex = liveExecutor();
    if (!ex) return { ok: false, error: "Live mode is off." };
    const r = await ex.closeAll(row.id, Date.now());
    const note = `${r.submitted} close${r.submitted === 1 ? "" : "s"} sent${r.skipped.length ? `; skipped: ${r.skipped.join("; ")}` : ""}.`;
    return { ok: true, view: await loadLiveView(row), note };
  } catch (error) {
    return fail(error);
  }
}

/** Stop for good: close everything, end the strategy once flat, destroy the wallet's key when it was the last one. */
export async function stopLiveAction(id: string): Promise<Result<{ view: LiveView; note: string }>> {
  try {
    const ownerId = await owner();
    const row = await strategyOf(id, ownerId);
    const link = await neonLiveStore.link(row.id);
    if (!link || link.status === "ended") return { ok: false, error: "Not live." };
    const now = Date.now();
    let note: string;
    if (link.status === "permission-ended") {
      // Nothing can be sent through a revoked delegate; close any leftover position in the Ostium app.
      await neonLiveStore.setLinkStatus(row.id, "ended", ["permission-ended"], now, "stopped after permission ended");
      await neonLiveStore.setStrategyLive(row.id, false);
      const rest = (await neonLiveStore.linksForSession(link.sessionId)).filter((l) => l.status !== "ended");
      if (rest.length === 0) {
        const session = await neonLiveStore.session(link.sessionId);
        if (session && (await neonLiveStore.setSessionStatus(session.id, "ended", ["pending", "active", "permission-ended"], now, "stopped"))) {
          await destroySessionKey(session.kmsKeyId).catch(() => undefined);
        }
      }
      note = "Stopped. The session key is destroyed; any position still open belongs to your wallet and closes in the Ostium app.";
    } else {
      await neonLiveStore.setLinkStatus(row.id, "closing", ["active", "paused"], now);
      const ex = liveExecutor();
      if (!ex) return { ok: false, error: "Live mode is off." };
      const r = await ex.closeAll(row.id, now);
      const s = (await ex.strategies()).find((x) => x.id === row.id);
      const ended = s ? await ex.finishIfFlat(s, now) : false;
      note = ended
        ? "Stopped. Nothing was open, so live trading ended and the session key is destroyed when no other strategy uses this wallet."
        : `Stopping: ${r.submitted} close${r.submitted === 1 ? "" : "s"} sent${r.skipped.length ? `, skipped: ${r.skipped.join("; ")}` : ""}. The strategy ends once the keeper confirms.`;
    }
    return { ok: true, view: await loadLiveView(row), note };
  } catch (error) {
    return fail(error);
  }
}

/** The trader's own removeDelegate transaction for MetaMask: revoking ends every strategy on this wallet at the next tick. */
export async function revokeTxAction(id: string): Promise<Result<{ tx: UnsignedTx }>> {
  try {
    const ownerId = await owner();
    const row = await strategyOf(id, ownerId);
    const link = await neonLiveStore.link(row.id);
    const session = link ? await neonLiveStore.session(link.sessionId) : null;
    if (!session) return { ok: false, error: "No wallet session for this strategy." };
    return { ok: true, tx: await getRemoveDelegateTx(session.trader) };
  } catch (error) {
    return fail(error);
  }
}

/** A USDC approval raising the wallet's allowance by `addUsd`, for MetaMask; `confirmTopUpAction` raises the cap once it lands. */
export async function topUpApprovalTxAction(id: string, addUsd: number): Promise<Result<{ tx: UnsignedTx; newAllowanceUsd: number }>> {
  try {
    const ownerId = await owner();
    const row = await strategyOf(id, ownerId);
    const add = z.number().finite().min(1).max(5_000).parse(addUsd);
    const link = await neonLiveStore.link(row.id);
    const session = link ? await neonLiveStore.session(link.sessionId) : null;
    if (!link || !session) return { ok: false, error: "Not live." };
    const problem = validateTerms(row.spec.size.collateralUsd, link.totalCapUsd + add, session.expiresAt ?? Date.now() + 86_400_000, Date.now());
    if (problem) return { ok: false, error: problem };
    const status = await getDelegationStatus(session.trader, session.sessionAddress);
    const newAllowanceUsd = status.allowanceUsd + add;
    return { ok: true, tx: await getApproveUsdcTx(session.trader, newAllowanceUsd), newAllowanceUsd };
  } catch (error) {
    return fail(error);
  }
}

export async function confirmTopUpAction(id: string, addUsd: number, expectedAllowanceUsd: number): Promise<Result<{ view: LiveView }>> {
  try {
    const ownerId = await owner();
    const row = await strategyOf(id, ownerId);
    const add = z.number().finite().min(1).max(5_000).parse(addUsd);
    const link = await neonLiveStore.link(row.id);
    const session = link ? await neonLiveStore.session(link.sessionId) : null;
    if (!link || !session) return { ok: false, error: "Not live." };
    const status = await getDelegationStatus(session.trader, session.sessionAddress);
    if (status.allowanceUsd + 0.01 < expectedAllowanceUsd) return { ok: false, error: `The approval is not confirmed yet ($${status.allowanceUsd.toFixed(2)}). Wait a few seconds and try again.` };
    await neonLiveStore.setLinkCap(row.id, link.totalCapUsd + add);
    await neonLiveStore.setDelegateCheck(session.id, Date.now(), status.allowanceUsd);
    return { ok: true, view: await loadLiveView(row) };
  } catch (error) {
    return fail(error);
  }
}
