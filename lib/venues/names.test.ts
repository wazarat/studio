import { describe, expect, it } from "vitest";

import { marketLabel, marketShort } from "@/lib/venues/names";

const m = (symbol: string, category: string) => {
  const [base, quote] = symbol.split("/");
  return { symbol, base, quote, category };
};

describe("market names", () => {
  it("shows ticker plus name, bare names for indices and commodities, pairs for FX", () => {
    expect(marketLabel(m("NVDA/USD", "stocks"), "simple")).toEqual({ primary: "NVDA · NVIDIA", secondary: "NVDA/USD" });
    expect(marketLabel(m("BTC/USD", "crypto"), "simple")).toEqual({ primary: "BTC · Bitcoin", secondary: "BTC/USD" });
    expect(marketLabel(m("XAU/USD", "commodities"), "simple")).toEqual({ primary: "Gold", secondary: "XAU/USD" });
    expect(marketLabel(m("US500/USD", "indices"), "simple")).toEqual({ primary: "S&P 500", secondary: "US500/USD" });
    expect(marketLabel(m("EUR/USD", "forex"), "simple")).toEqual({ primary: "EUR/USD", secondary: null });
    expect(marketLabel(m("NVDA/USD", "stocks"), "pairs")).toEqual({ primary: "NVDA/USD", secondary: null });
    expect(marketLabel(m("ZZZ/USD", "stocks"), "simple").primary).toBe("ZZZ");
    expect(marketLabel(m("XRP/USD", "crypto"), "simple").primary).toBe("XRP");
    expect(marketShort(m("XAU/USD", "commodities"), "simple")).toBe("Gold");
    expect(marketShort(m("XAU/USD", "commodities"), "pairs")).toBe("XAU/USD");
  });
});
