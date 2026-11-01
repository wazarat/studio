import { createPublicClient, http, type Hex } from "viem";
import { arbitrumSepolia } from "viem/chains";
import { afterAll, describe, expect, it } from "vitest";

import { compareToReference } from "@/lib/chainlink/compare";
import { readReference, toleranceBps } from "@/lib/chainlink/read";
import { checkRisk } from "@/lib/risk/check";
import { getDevSigner } from "@/lib/signers/dev";
import { findOrdersByTxHash, getApproveUsdcTx, getBalances, getFills, isTestnet, ostium } from "@/lib/venues/ostium";
import type { Position } from "@/lib/venues/types";

/**
 * The testnet smoke run (Studio step 3, item 6): open, set TP/SL, top up,
 * close through the venue layer and the dev signer, then read the fills
 * back. Skipped unless OSTIUM_SMOKE=1 and a dev key is set, because it
 * spends real Sepolia gas and mock USDC. Run it with the env loaded:
 *
 *   set -a; . ./.env.local; set +a; OSTIUM_SMOKE=1 npx vitest run lib/venues/ostium.smoke.test.ts
 */

const enabled = process.env.OSTIUM_SMOKE === "1" && Boolean(process.env.OSTIUM_DEV_PRIVATE_KEY);
const MARKET = "0"; // BTC/USD, open around the clock
const COLLATERAL = 10;
const LEVERAGE = 2;

const log: string[] = [];
const say = (line: string) => {
  log.push(line);
  console.log(`[smoke] ${line}`);
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe.skipIf(!enabled)("Ostium testnet smoke", () => {
  const signer = enabled ? getDevSigner()! : null;
  const pc = createPublicClient({ chain: arbitrumSepolia, transport: http(process.env.OSTIUM_RPC_URL || undefined) });
  const sent: { label: string; hash: Hex }[] = [];

  async function send(label: string, build: () => Promise<{ to: Hex; data: Hex; value: string; from: Hex; chainId: number }>) {
    const tx = await build();
    const { hash } = await signer!.send(tx);
    sent.push({ label, hash });
    say(`${label}: ${hash}`);
    const receipt = await pc.waitForTransactionReceipt({ hash, timeout: 120_000 });
    expect(receipt.status, `${label} reverted`).toBe("success");
    return hash;
  }

  /** Ostium's keeper executes market orders a few seconds after the request lands. */
  async function waitForOrder(hash: Hex, label: string) {
    for (let i = 0; i < 30; i++) {
      await sleep(4_000);
      const orders = await findOrdersByTxHash(hash);
      const o = orders[0];
      if (o && !o.isPending) {
        say(`${label} ${o.isCancelled ? `cancelled: ${o.cancelReason ?? "no reason"}` : `executed at ${o.price}`}`);
        expect(o.isCancelled, `${label} was cancelled: ${o.cancelReason}`).toBe(false);
        return o;
      }
    }
    throw new Error(`${label} not executed after 2 minutes`);
  }

  async function positionsHere(): Promise<Position[]> {
    return (await ostium.positions(signer!.address)).filter((p) => p.marketId === MARKET);
  }

  afterAll(() => {
    if (log.length) console.log(`\n[smoke] summary\n${log.map((l) => `  ${l}`).join("\n")}`);
  });

  it("opens, updates and closes a small BTC position and reads the fills back", async () => {
    expect(isTestnet()).toBe(true);
    const startedAt = Date.now();
    const trader = signer!.address;
    say(`signer ${trader}`);

    const balances = await getBalances(trader);
    say(`balances ${balances.usdc} USDC, ${balances.eth} ETH, allowance ${balances.allowanceUsdc}`);
    expect(balances.eth, "no Sepolia ETH for gas").toBeGreaterThan(0);
    expect(balances.usdc, "no mock USDC").toBeGreaterThanOrEqual(COLLATERAL + 1);

    const market = (await ostium.markets()).find((m) => m.id === MARKET)!;
    expect(market.hours.isOpen, `${market.symbol} is closed`).toBe(true);

    if (balances.allowanceUsdc < COLLATERAL * 5) {
      await send("approve 100 USDC", () => getApproveUsdcTx(trader, 100));
    }

    const intent = { marketId: MARKET, side: "long" as const, collateralUsd: COLLATERAL, leverage: LEVERAGE, orderType: "market" as const };
    const preview = await ostium.previewOpen(intent);
    say(`preview entry ${preview.entryPrice}, notional ${preview.sizeUsd} USD, fees ${preview.fees.totalUsd}, liq ${preview.liquidationPrice}`);
    expect(preview.sizeUsd).toBeGreaterThan(COLLATERAL);
    const reading = await readReference(market.symbol);
    const reference = reading ? compareToReference(preview.midPrice, reading, toleranceBps()) : null;
    say(`chainlink ${reference ? `${reference.referencePrice} (${reference.deviationBps.toFixed(1)} bps, fresh ${reference.fresh})` : "no feed"}`);
    const risk = checkRisk({
      kind: "open",
      tier: "studio",
      testnet: true,
      intent,
      market,
      sizeUsd: preview.sizeUsd,
      strategy: { strategyId: "smoke", openNotionalUsd: 0, dailyLossLimitUsd: 100, lossTodayUsd: 0 },
      reference,
    });
    say(`risk ${risk.ok ? "ok" : "refused"}${risk.notes.length ? ` (notes: ${risk.notes.map((n) => n.code).join(", ")})` : ""}`);
    expect(risk.ok).toBe(true);

    // A position left by an earlier run is reused rather than stacked.
    let position: Position | undefined = (await positionsHere())[0];
    let opened = false;
    if (position) {
      say(`reusing open position #${position.index} from an earlier run`);
    } else {
      const openHash = await send("open 10 USDC x2 long", () => ostium.buildOpen(trader, intent));
      await waitForOrder(openHash, "open");
      opened = true;
      for (let i = 0; i < 15 && !position; i++) {
        position = (await positionsHere())[0];
        if (!position) await sleep(4_000);
      }
      expect(position, "the new position never showed up").toBeDefined();
    }
    say(`position #${position!.index} entry ${position!.entryPrice}, size ${position!.sizeUsd}, collateral ${position!.collateralUsd}`);

    const tp = Math.round(position!.entryPrice * 1.05);
    const sl = Math.round(position!.entryPrice * 0.95);
    const tpslTxs = await ostium.buildUpdate(trader, { marketId: MARKET, index: position!.index, takeProfit: tp, stopLoss: sl });
    expect(tpslTxs).toHaveLength(2);
    await send(`set TP ${tp}`, async () => tpslTxs[0]);
    await send(`set SL ${sl}`, async () => tpslTxs[1]);
    await sleep(6_000);
    let updated = (await positionsHere()).find((p) => p.index === position!.index);
    say(`after TP/SL: tp ${updated?.takeProfit}, sl ${updated?.stopLoss}`);
    expect(updated?.takeProfit).toBeCloseTo(tp, 0);
    expect(updated?.stopLoss).toBeCloseTo(sl, 0);

    const topUpTxs = await ostium.buildUpdate(trader, { marketId: MARKET, index: position!.index, collateralDeltaUsd: 5 });
    expect(topUpTxs).toHaveLength(1);
    await send("top up +5 USDC", async () => topUpTxs[0]);
    for (let i = 0; i < 10; i++) {
      await sleep(4_000);
      updated = (await positionsHere()).find((p) => p.index === position!.index);
      if (updated && updated.collateralUsd > position!.collateralUsd + 4) break;
    }
    say(`after top-up: collateral ${updated?.collateralUsd}, leverage ${updated?.leverage}`);
    expect(updated!.collateralUsd).toBeGreaterThan(position!.collateralUsd + 4);

    expect(checkRisk({ kind: "close" }).ok).toBe(true);
    const closeHash = await send("close 100%", () =>
      ostium.buildClose(trader, { marketId: MARKET, index: position!.index, closePercent: 100 }),
    );
    await waitForOrder(closeHash, "close");
    for (let i = 0; i < 10; i++) {
      await sleep(4_000);
      if (!(await positionsHere()).some((p) => p.index === position!.index)) break;
    }
    expect((await positionsHere()).some((p) => p.index === position!.index), "position still open").toBe(false);

    // Open and Close fills carry the keeper's execution hash, not the one we
    // sent, so this run's fills are picked by market and time.
    const fills = await getFills(trader, 50);
    const ours = fills.filter((f) => f.marketId === MARKET && f.at >= startedAt - 60_000);
    for (const f of ours) say(`fill ${f.action} ${f.symbol} ${f.side} at ${f.price}, size ${f.sizeUsd}, pnl ${f.closedPnlUsd}, ${f.hash}`);
    if (opened) expect(ours.map((f) => f.action)).toContain("Open");
    expect(ours.map((f) => f.action)).toContain("Close");
  });
});
