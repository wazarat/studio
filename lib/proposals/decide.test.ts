import { describe, expect, it } from "vitest";

import { decideProposal, specDiff } from "@/lib/proposals/decide";
import type { Proposal } from "@/lib/proposals/types";
import type { StrategySpec } from "@/lib/strategies/spec";

const spec: StrategySpec = {
  id: "s1",
  name: "BTC MA 10/20",
  market: { venue: "ostium", marketId: "0", symbol: "BTC/USD" },
  direction: "long",
  entry: { kind: "maCross", fast: 10, slow: 20 },
  exit: {},
  size: { collateralUsd: 100, leverage: 2 },
  wake: { kind: "candle-close", resolution: "1D" },
  caps: { maxPositionUsd: 1000, dailyLossLimitUsd: 50 },
  tier: "studio",
  status: "draft",
};
const proposal = (over: Partial<Proposal> = {}): Proposal => ({
  id: "p1",
  strategyId: "s1",
  ownerId: "u1",
  kind: "change",
  proposedSpec: { ...spec, name: "BTC MA 5/20", entry: { kind: "maCross", fast: 5, slow: 20 }, status: "paper" },
  reason: "faster",
  backtest: null,
  clientId: "c",
  clientName: "Claude Code",
  status: "pending",
  createdAt: 0,
  decidedAt: null,
  ...over,
});

describe("decideProposal", () => {
  it("applies a change only to a draft, with the stored id and draft status", () => {
    const d = decideProposal(proposal(), "draft", "accept");
    expect(d).toMatchObject({ ok: true, action: "apply-change" });
    if (d.ok && d.action === "apply-change") {
      expect(d.spec.id).toBe("s1");
      expect(d.spec.status).toBe("draft");
      expect(d.spec.entry).toEqual({ kind: "maCross", fast: 5, slow: 20 });
    }
    expect(decideProposal(proposal(), "paper", "accept")).toMatchObject({ ok: false });
  });

  it("rejecting never changes anything and a decided proposal cannot be decided again", () => {
    expect(decideProposal(proposal(), "paper", "reject")).toEqual({ ok: true, action: "reject" });
    expect(decideProposal(proposal({ status: "accepted" }), "draft", "accept")).toMatchObject({ ok: false });
    expect(decideProposal(proposal({ status: "rejected" }), "draft", "reject")).toMatchObject({ ok: false });
  });

  it("paper requests only apply when the status fits", () => {
    expect(decideProposal(proposal({ kind: "paper-start", proposedSpec: null }), "draft", "accept")).toEqual({ ok: true, action: "paper-start" });
    expect(decideProposal(proposal({ kind: "paper-start", proposedSpec: null }), "paper", "accept")).toMatchObject({ ok: false });
    expect(decideProposal(proposal({ kind: "paper-stop", proposedSpec: null }), "paper", "accept")).toEqual({ ok: true, action: "paper-stop" });
    expect(decideProposal(proposal({ kind: "paper-stop", proposedSpec: null }), "draft", "accept")).toMatchObject({ ok: false });
  });
});

describe("specDiff", () => {
  it("lists only what changes, in the panel's words", () => {
    const d = specDiff(spec, { ...spec, exit: { stopLossPct: 8 }, size: { collateralUsd: 100, leverage: 3 } });
    expect(d).toEqual([
      { field: "Stop loss, %", from: "off", to: "8" },
      { field: "Leverage", from: "2", to: "3" },
    ]);
    expect(specDiff(spec, spec)).toEqual([]);
  });
});
