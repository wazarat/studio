import { describe, expect, it } from "vitest";

import { historyWindow, verdict } from "@/lib/strategies/verdict";

const sum = (returnPct: number, maxDrawdownPct: number) =>
  ({ returnPct, maxDrawdownPct, maxDrawdownUsd: 0, trades: 0, winRatePct: 0, feesUsd: 0, openingFeesUsd: 0, rolloverUsd: 0, netPnlUsd: 0, finalEquityUsd: 0 });

describe("verdict", () => {
  it("says trailed or beat in points, and the drawdown difference", () => {
    expect(verdict({ strategy: sum(135.8, 33.0), buyAndHold: { ...sum(238.8, 54.6), trade: null } })).toBe("Trailed buy and hold by 103 points with 22 points less drawdown.");
    expect(verdict({ strategy: sum(50, 40), buyAndHold: { ...sum(38, 20), trade: null } })).toBe("Beat buy and hold by 12 points with 20 points more drawdown.");
    expect(verdict({ strategy: sum(10.2, 5), buyAndHold: { ...sum(10, 5.2), trade: null } })).toBe("Matched buy and hold with the same drawdown.");
    expect(verdict({ strategy: sum(9, 5), buyAndHold: { ...sum(10, 5), trade: null } })).toBe("Trailed buy and hold by 1 point with the same drawdown.");
  });
});

describe("historyWindow", () => {
  it("labels the window and flags short history", () => {
    const w = historyWindow({ historyStart: Date.UTC(2024, 0, 1), windowEnd: Date.UTC(2026, 9, 31) });
    expect(w.label).toBe("Jan 2024 to Oct 2026");
    expect(w.span).toBe("about 2.8 years");
    expect(w.short).toBe(true);
    expect(historyWindow({ historyStart: Date.UTC(2015, 0, 1), windowEnd: Date.UTC(2026, 0, 1) }).short).toBe(false);
    expect(historyWindow({ historyStart: Date.UTC(2026, 0, 1), windowEnd: Date.UTC(2026, 5, 1) }).span).toBe("about 5 months");
  });
});
