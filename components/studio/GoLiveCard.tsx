"use client";

import { useCallback, useEffect, useState } from "react";
import type { Hex } from "viem";

import {
  activateLiveAction,
  closeAllLiveAction,
  confirmTopUpAction,
  liveStateAction,
  pauseLiveAction,
  prepareLiveAction,
  revokeTxAction,
  stopLiveAction,
  topUpApprovalTxAction,
} from "@/app/(app)/studio/strategies/live-actions";
import { Button } from "@/components/ui/Button";
import { Card, CardSection } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { tradesText, validateTerms } from "@/lib/live/terms";
import type { LiveView } from "@/lib/live/view";
import { cn } from "@/lib/utils";
import { formatAgo, formatPrice, formatUsd } from "@/lib/venues/format";
import { connectWallet, ensureLiveChain, getInjected, sendFromWallet, waitForReceipt, WalletError } from "@/lib/wallet/metamask";

/**
 * The Go-live card (Studio step 7): connect the wallet, read the terms in
 * plain words, approve exactly the total in MetaMask and register the
 * session account as the wallet's delegate; then the live view with the
 * remaining approval shown as trades, the strategy's own positions, the
 * orders it sent, and Pause, Close all, Stop and Revoke.
 */
type Step = "idle" | "connecting" | "preparing" | "approving" | "delegating" | "activating" | "working";

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
const dayInput = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const LIVE_STATES = new Set(["active", "paused", "closing", "permission-ended"]);

export function GoLiveCard({ strategyId, initial, saved, onStatus }: { strategyId: string; initial: LiveView; saved: boolean; onStatus: (status: "live" | "draft") => void }) {
  const [view, setView] = useState<LiveView>(initial);
  const [wallet, setWallet] = useState<Hex | null>(initial.session?.trader ?? null);
  const [step, setStep] = useState<Step>("idle");
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [total, setTotal] = useState(String(initial.terms.defaultTotalUsd));
  const [expiry, setExpiry] = useState(dayInput(initial.terms.defaultExpiryMs));
  const [topUp, setTopUp] = useState(String(initial.terms.collateralUsd * 2));
  const [now, setNow] = useState(() => Date.now());

  const live = !!view.link && LIVE_STATES.has(view.link.status);
  const busy = step !== "idle";

  const refresh = useCallback(async () => {
    const res = await liveStateAction(strategyId);
    if (res.ok) {
      setView(res.view);
      onStatus(res.view.link && LIVE_STATES.has(res.view.link.status) ? "live" : "draft");
    }
  }, [strategyId, onStatus]);

  useEffect(() => {
    if (!live) return;
    const t = setInterval(() => {
      setNow(Date.now());
      void refresh();
    }, 30_000);
    return () => clearInterval(t);
  }, [live, refresh]);

  const run = async (next: Step, fn: () => Promise<string | void>) => {
    setError(null);
    setNote(null);
    setStep(next);
    try {
      const n = await fn();
      if (n) setNote(n);
    } catch (e) {
      setError(e instanceof WalletError ? e.message : e instanceof Error ? e.message : String(e));
    } finally {
      setStep("idle");
    }
  };

  const connect = () =>
    run("connecting", async () => {
      const a = await connectWallet();
      await ensureLiveChain();
      setWallet(a);
    });

  const totalUsd = Number(total);
  const expiresAtMs = new Date(`${expiry}T23:59:00Z`).getTime();
  const termsProblem = validateTerms(view.terms.collateralUsd, totalUsd, expiresAtMs, now);

  const goLive = () =>
    run("preparing", async () => {
      if (!wallet) throw new Error("Connect your wallet first.");
      const prep = await prepareLiveAction(strategyId, wallet, { totalCapUsd: totalUsd, expiresAtMs });
      if (!prep.ok) throw new Error(prep.error);
      setStep("approving");
      const approveHash = await sendFromWallet(wallet, prep.approveTx);
      await waitForReceipt(approveHash);
      let delegateHash: Hex | undefined;
      if (prep.delegateTx) {
        setStep("delegating");
        delegateHash = await sendFromWallet(wallet, prep.delegateTx);
        await waitForReceipt(delegateHash);
      }
      setStep("activating");
      let last: string = "";
      for (let i = 0; i < 4; i++) {
        const act = await activateLiveAction(strategyId, wallet, { totalCapUsd: totalUsd, expiresAtMs }, { approveTx: approveHash, delegateTx: delegateHash });
        if (act.ok) {
          setView(act.view);
          onStatus("live");
          return act.note;
        }
        last = act.error;
        await new Promise((r) => setTimeout(r, 4000));
      }
      throw new Error(last);
    });

  const simple = (fn: () => Promise<{ ok: true; view: LiveView; note?: string } | { ok: false; error: string }>) =>
    run("working", async () => {
      const res = await fn();
      if (!res.ok) throw new Error(res.error);
      setView(res.view);
      onStatus(res.view.link && LIVE_STATES.has(res.view.link.status) ? "live" : "draft");
      return res.note;
    });

  const revoke = () =>
    run("working", async () => {
      if (!wallet) throw new Error("Connect your wallet first.");
      const res = await revokeTxAction(strategyId);
      if (!res.ok) throw new Error(res.error);
      const hash = await sendFromWallet(wallet, res.tx);
      await waitForReceipt(hash);
      await refresh();
      return "Delegate removed in your wallet. Every strategy on this wallet shows 'permission ended' at the next tick and nothing more is sent.";
    });

  const doTopUp = () =>
    run("working", async () => {
      if (!wallet) throw new Error("Connect your wallet first.");
      const add = Number(topUp);
      const res = await topUpApprovalTxAction(strategyId, add);
      if (!res.ok) throw new Error(res.error);
      const hash = await sendFromWallet(wallet, res.tx);
      await waitForReceipt(hash);
      for (let i = 0; i < 4; i++) {
        const c = await confirmTopUpAction(strategyId, add, res.newAllowanceUsd);
        if (c.ok) {
          setView(c.view);
          return `Approval raised to ${formatUsd(res.newAllowanceUsd)}.`;
        }
        await new Promise((r) => setTimeout(r, 4000));
      }
      throw new Error("The approval landed but could not be confirmed; refresh in a moment.");
    });

  const stepText: Record<Step, string> = {
    idle: "",
    connecting: "Waiting for your wallet…",
    preparing: "Creating the session account…",
    approving: "Confirm the USDC approval in MetaMask…",
    delegating: "Confirm the delegate in MetaMask…",
    activating: "Checking on-chain…",
    working: "Working…",
  };

  const header = (
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <h2 className="font-display text-lg font-semibold text-ink-50">{live ? "Live trading" : "Go live"}</h2>
      <p className={cn("text-xs", live && view.link?.status === "active" ? "text-emerald-400 light:text-emerald-700" : "text-ink-400")}>
        {!view.enabled ? `Off · ${view.network === "Arbitrum Sepolia" ? "AWS KMS not configured" : "testnet only in this step"}` : live ? statusLine(view) : `${view.network} · your wallet keeps the USDC`}
      </p>
    </div>
  );

  if (!view.enabled) {
    return (
      <Card>
        <CardSection className="space-y-2">
          {header}
          <p className="text-xs text-ink-400">Live trading needs OSTIUM_TESTNET=true and AWS KMS credentials on the server. Paper trading and backtests are unaffected.</p>
        </CardSection>
      </Card>
    );
  }

  if (!live) {
    return (
      <Card>
        <CardSection className="space-y-3">
          {header}
          {view.link?.status === "ended" ? <p className="text-xs text-ink-400">Live trading ended{view.link.endedReason ? ` (${view.link.endedReason})` : ""}. You can go live again below.</p> : null}
          {!saved ? <p className="text-xs text-ink-400">Save the strategy first.</p> : null}
          {!getInjected() ? (
            <p className="text-xs text-amber-300">No wallet found in this browser. Install MetaMask, then reload this page. Any wallet that speaks the standard injected interface works.</p>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="secondary" size="sm" disabled={busy || !saved} onClick={connect}>
              {wallet ? `Wallet ${short(wallet)}` : step === "connecting" ? "Connecting…" : "Connect wallet"}
            </Button>
            {wallet ? <span className="text-xs text-ink-400">Arbitrum Sepolia · the wallet is the trader; positions and USDC stay in it</span> : null}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-xs text-ink-300">
              <span>Total USDC to approve</span>
              <Input inputMode="decimal" value={total} onChange={(e) => setTotal(e.target.value)} disabled={busy} />
              <span className="block text-[11px] text-ink-500">
                {Number.isFinite(totalUsd) ? tradesText(totalUsd, view.terms.collateralUsd) : ""} · beta cap {formatUsd(view.terms.maxTotalUsd, 0)}
              </span>
            </label>
            <label className="space-y-1 text-xs text-ink-300">
              <span>Expires on</span>
              <Input type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} disabled={busy} />
              <span className="block text-[11px] text-ink-500">Studio stops entering after this date; the wallet's approval itself does not expire.</span>
            </label>
          </div>
          <ul className="space-y-1 rounded-lg border border-ink-700/40 bg-ink-900/40 p-3 text-xs text-ink-200">
            <li>
              <b>Each trade:</b> {formatUsd(view.terms.collateralUsd, 0)} of USDC at {view.terms.leverage}x, long only, never more than {formatUsd(view.terms.maxPositionUsd, 0)} open for this strategy.
            </li>
            <li>
              <b>Daily stop:</b> {view.terms.dailyLossLimitUsd > 0 ? `no new trade once ${formatUsd(view.terms.dailyLossLimitUsd, 0)} is lost in a day` : "none set (set one in Risk before going live)"}.
            </li>
            <li>
              <b>Total approval:</b> {Number.isFinite(totalUsd) ? `${formatUsd(totalUsd, 0)}, ${tradesText(totalUsd, view.terms.collateralUsd)}` : "—"}. This is the most USDC the session can commit; it is set as an exact allowance, not unlimited.
              {view.siblings.length ? ` The wallet's approval also covers ${view.siblings.length} other strateg${view.siblings.length === 1 ? "y" : "ies"} here.` : ""}
            </li>
            <li>
              <b>Expiry:</b> {expiry}. After it, nothing new is opened.
            </li>
            <li>
              <b>Allowed contracts</b> on {view.network}: Ostium Trading {short(view.contracts.trading)}, Trading Storage {short(view.contracts.tradingStorage)} (pulls the USDC), USDC {short(view.contracts.usdc)}. The session can only trade; it cannot move USDC anywhere but into and out of your positions.
            </li>
            <li>
              <b>Take profit and stop loss</b> go on the Ostium trade itself, so they fire even if Studio is down.
            </li>
            <li>
              <b>Revoke any time</b> in MetaMask (remove delegate, or set the approval to 0): Studio stops at the next check.
            </li>
          </ul>
          {termsProblem && wallet ? <p className="text-xs text-rose-400">{termsProblem}</p> : null}
          {error ? <p className="text-xs text-rose-400">{error}</p> : null}
          {note ? <p className="text-xs text-ink-300">{note}</p> : null}
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" size="sm" disabled={busy || !wallet || !saved || !!termsProblem} onClick={goLive}>
              {busy && step !== "connecting" ? stepText[step] : "Go live: approve and set delegate in MetaMask"}
            </Button>
            <span className="text-[11px] text-ink-500">Two MetaMask confirmations. Studio never sees a key of yours.</span>
          </div>
        </CardSection>
      </Card>
    );
  }

  const link = view.link!;
  const session = view.session!;
  const ended = link.status === "permission-ended";
  return (
    <Card>
      <CardSection className="space-y-3">
        {header}
        {ended ? (
          <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-200">
            Permission ended{link.endedReason ? ` (${link.endedReason})` : ""}. Nothing more is sent. Any position still open belongs to your wallet; close it in the Ostium app or go live again. Press Stop to clear this strategy.
          </p>
        ) : null}
        <div className="grid gap-2 text-xs text-ink-300 sm:grid-cols-2">
          <p>
            Wallet <span className="font-mono text-ink-100">{short(session.trader)}</span> · session <span className="font-mono text-ink-100">{short(session.sessionAddress)}</span>
          </p>
          <p>
            Expires {session.expiresAt ? dayInput(session.expiresAt) : "never"} · live since {dayInput(link.startedAt)}
          </p>
          <p className={cn(link.low ? "text-amber-300" : undefined)}>
            Remaining for this strategy: {formatUsd(link.remainingUsd, 0)}, {link.remainingText}
            {link.low ? " · running low, top up below" : ""}
          </p>
          <p>
            Wallet approval across strategies: {view.wallet ? formatUsd(view.wallet.allowanceUsd, 0) : "…"}
            {view.siblings.length ? ` · ${view.siblings.length} other live` : ""} · USDC in wallet {view.wallet ? formatUsd(view.wallet.usdcUsd, 0) : "…"}
          </p>
        </div>

        {view.positions.length ? (
          <table className="w-full text-xs">
            <thead className="text-ink-500">
              <tr className="text-left">
                <th className="py-1 font-medium">Position</th>
                <th className="py-1 font-medium">Entry</th>
                <th className="py-1 font-medium">TP / SL</th>
                <th className="py-1 font-medium text-right">Unrealised</th>
              </tr>
            </thead>
            <tbody className="text-ink-200">
              {view.positions.map((p) => (
                <tr key={p.pid} className="border-t border-ink-700/40">
                  <td className="py-1">
                    Long {p.symbol} {formatUsd(p.sizeUsd, 0)} at {p.leverage}x <span className="text-ink-500">· pid {p.pid}</span>
                  </td>
                  <td className="py-1">{formatPrice(p.entryPrice)}</td>
                  <td className="py-1">
                    {p.takeProfit ? formatPrice(p.takeProfit) : "—"} / {p.stopLoss ? formatPrice(p.stopLoss) : "—"}
                  </td>
                  <td className={cn("py-1 text-right", p.unrealizedPnlUsd >= 0 ? "text-emerald-400" : "text-rose-400")}>{formatUsd(p.unrealizedPnlUsd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-xs text-ink-500">No open position from this strategy.</p>
        )}

        {view.orders.length ? (
          <ul className="space-y-1 text-[11px] text-ink-400">
            {view.orders.slice(0, 6).map((o) => (
              <li key={o.id}>
                {formatAgo(o.createdAt, now)} · {o.kind} {o.symbol} · {o.status}
                {o.fillPrice ? ` at ${formatPrice(o.fillPrice)}` : ""}
                {o.closeReason ? ` · closed ${o.closeReason}${o.closePnlUsd !== undefined ? ` ${formatUsd(o.closePnlUsd)}` : ""}` : ""}
                {o.error ? ` · ${o.error}` : ""}
                {o.txHash ? (
                  <>
                    {" · "}
                    <a className="underline" href={`https://sepolia.arbiscan.io/tx/${o.txHash}`} target="_blank" rel="noreferrer">
                      tx
                    </a>
                  </>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}

        {error ? <p className="text-xs text-rose-400">{error}</p> : null}
        {note ? <p className="text-xs text-ink-300">{note}</p> : null}
        {busy ? <p className="text-xs text-ink-400">{stepText[step]}</p> : null}

        <div className="flex flex-wrap gap-2">
          {!wallet ? (
            <Button type="button" variant="secondary" size="sm" disabled={busy} onClick={connect}>
              Connect wallet
            </Button>
          ) : null}
          {link.status === "active" ? (
            <Button type="button" variant="secondary" size="sm" disabled={busy} onClick={() => simple(() => pauseLiveAction(strategyId))}>
              Pause
            </Button>
          ) : link.status === "paused" ? (
            <Button type="button" variant="secondary" size="sm" disabled={busy} onClick={() => simple(() => pauseLiveAction(strategyId, true))}>
              Resume
            </Button>
          ) : null}
          {!ended ? (
            <Button type="button" variant="secondary" size="sm" disabled={busy || view.positions.length === 0} onClick={() => simple(() => closeAllLiveAction(strategyId))}>
              Close all
            </Button>
          ) : null}
          <Button type="button" variant="outline" size="sm" disabled={busy || link.status === "closing"} onClick={() => simple(() => stopLiveAction(strategyId))}>
            {link.status === "closing" ? "Stopping…" : "Stop"}
          </Button>
          <Button type="button" variant="ghost" size="sm" disabled={busy || !wallet || (view.wallet ? !view.wallet.delegateMatches : false)} onClick={revoke}>
            Revoke in MetaMask
          </Button>
        </div>
        {!ended ? (
          <div className="flex flex-wrap items-center gap-2 text-xs text-ink-300">
            <span>Top up the approval by</span>
            <Input className="h-8 w-24" inputMode="decimal" value={topUp} onChange={(e) => setTopUp(e.target.value)} disabled={busy} />
            <Button type="button" variant="secondary" size="sm" disabled={busy || !wallet || !(Number(topUp) > 0)} onClick={doTopUp}>
              Approve in MetaMask
            </Button>
          </div>
        ) : null}
        <p className="text-[11px] text-ink-500">
          Pause keeps positions open and stops new entries. Close all closes this strategy's positions now, even while paused. Stop closes everything, ends live trading and destroys the session key once no strategy uses this wallet. Revoke removes the delegate in your wallet, which stops every strategy on it.
        </p>
      </CardSection>
    </Card>
  );
}

function statusLine(v: LiveView): string {
  const l = v.link!;
  switch (l.status) {
    case "active":
      return `Live · ${l.remainingText}`;
    case "paused":
      return "Paused · no new entries";
    case "closing":
      return "Stopping · closing positions";
    case "permission-ended":
      return "Permission ended";
    default:
      return l.status;
  }
}
