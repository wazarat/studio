import type { Market } from "@/lib/venues/types";

/**
 * Market names (step 5b). "Simple names" shows the ticker with the full
 * name for stocks and crypto, and just the name for indices and
 * commodities; "Pair symbols" shows Ostium's pair. FX keeps the pair in
 * both. Every market on Ostium is a synthetic perpetual: no shares,
 * coins or ounces are owned.
 */
export type MarketNames = "simple" | "pairs";

export const MARKET_NAME_OPTIONS = [
  { value: "simple", label: "Simple names" },
  { value: "pairs", label: "Pair symbols" },
] as const;

const FULL_NAMES: Record<string, string> = {
  // crypto
  BTC: "Bitcoin", ETH: "Ethereum", SOL: "Solana", BNB: "BNB", XRP: "XRP", TRX: "Tron", HYPE: "Hyperliquid", LINK: "Chainlink", ADA: "Cardano",
  // indices
  US500: "S&P 500", US30: "Dow Jones", US100: "Nasdaq 100", JP225: "Nikkei 225", UK100: "FTSE 100", GER40: "DAX 40", HK50: "Hang Seng",
  // commodities
  XAU: "Gold", XAG: "Silver", XPT: "Platinum", XPD: "Palladium", XCU: "Copper", WTI: "WTI crude oil", BRENT: "Brent crude oil",
  // stocks
  AAPL: "Apple", AMD: "AMD", AMZN: "Amazon", ARM: "Arm", ASML: "ASML", AVGO: "Broadcom", BB: "BlackBerry", BMNR: "Bitmine", CAT: "Caterpillar",
  COIN: "Coinbase", COST: "Costco", CRCL: "Circle", CRWV: "CoreWeave", CVX: "Chevron", DELL: "Dell", GEV: "GE Vernova", GLXY: "Galaxy Digital",
  GOOG: "Alphabet", HOOD: "Robinhood", INTC: "Intel", LLY: "Eli Lilly", META: "Meta", MP: "MP Materials", MRNA: "Moderna", MRVL: "Marvell",
  MSFT: "Microsoft", MSTR: "Strategy", MU: "Micron", NBIS: "Nebius", NFLX: "Netflix", NVDA: "NVIDIA", ORCL: "Oracle", PLTR: "Palantir",
  RIVN: "Rivian", SBET: "SharpLink Gaming", SHEL: "Shell", SKHY: "SK Hynix", SMCI: "Super Micro", SNDK: "Sandisk", TSLA: "Tesla", TSM: "TSMC", XOM: "ExxonMobil",
  // etfs
  HYG: "High-yield bond ETF", TLT: "20-year Treasury ETF", UNG: "Natural gas ETF", URA: "Uranium ETF", XLE: "Energy sector ETF", REMX: "Rare earths ETF",
};

export function fullName(base: string): string | null {
  return FULL_NAMES[base] ?? null;
}

export interface MarketLabel {
  /** The main text: "NVDA · NVIDIA", "Gold", "EUR/USD" or the pair. */
  primary: string;
  /** The pair when it is not already the primary. */
  secondary: string | null;
}

export function marketLabel(market: Pick<Market, "symbol" | "base" | "quote" | "category">, mode: MarketNames): MarketLabel {
  if (mode === "pairs" || market.category === "forex") return { primary: market.symbol, secondary: null };
  const name = fullName(market.base);
  if (market.category === "indices" || market.category === "commodities") {
    return { primary: name ?? market.base, secondary: market.symbol };
  }
  return { primary: name && name !== market.base ? `${market.base} · ${name}` : market.base, secondary: market.symbol };
}

/** Short form for tables and lines: "NVIDIA", "Gold", "Bitcoin", or the pair. */
export function marketShort(market: Pick<Market, "symbol" | "base" | "quote" | "category">, mode: MarketNames): string {
  if (mode === "pairs" || market.category === "forex") return market.symbol;
  return fullName(market.base) ?? market.symbol;
}

export const PERP_NOTE = "Synthetic perpetual on Ostium: you trade the price, no shares, coins or ounces are owned.";
