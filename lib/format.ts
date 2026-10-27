/**
 * Number/date formatting shared by the analytics section. Everything here is
 * deterministic (fixed en-US locale, UTC) so server render and client
 * hydration always agree.
 */

const USD_TIERS: Array<{ min: number; div: number; suffix: string }> = [
  { min: 1e12, div: 1e12, suffix: "T" },
  { min: 1e9, div: 1e9, suffix: "B" },
  { min: 1e6, div: 1e6, suffix: "M" },
  { min: 1e3, div: 1e3, suffix: "K" },
];

/** $866.47M-style compact USD. */
export function formatUsdCompact(value: number): string {
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  for (const tier of USD_TIERS) {
    if (abs >= tier.min) {
      return `${sign}$${(abs / tier.div).toFixed(2)}${tier.suffix}`;
    }
  }
  return `${sign}$${abs.toFixed(abs >= 100 ? 0 : 2)}`;
}

/** 1.7M / 12.5K / 987-style compact count. */
export function formatCount(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1e9) return `${(value / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
  return String(Math.round(value));
}

/** Signed percentage, one decimal: "+8.4%" / "-19.2%". */
export function formatPct(pct: number): string {
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}%`;
}

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

/** "Jul 30" from an ISO date/timestamp (UTC). */
export function formatDayShort(iso: string): string {
  const d = new Date(iso);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

/** "Jul 31, 14:00 UTC" from an ISO timestamp. */
export function formatAsOf(iso: string): string {
  const d = new Date(iso);
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${hh}:${mm} UTC`;
}

/** "Jul 30" for date-only strings; keeps chart axis labels tiny. */
export function formatUnit(value: number, unit: "usd" | "count"): string {
  return unit === "usd" ? formatUsdCompact(value) : formatCount(value);
}

/**
 * ETH per whole token from pool reserves, or "n/a" when either side is empty.
 * Shared by the explore board, the token page and the launch form's opening
 * price so the number a launcher sees equals what the board shows later.
 */
export function formatPriceEth(ethReserveWei: bigint, tokenReserveWei: bigint): string {
  if (tokenReserveWei === 0n) return "n/a";
  const wei = (ethReserveWei * 10n ** 18n) / tokenReserveWei;
  const eth = Number(wei) / 1e18;
  if (eth === 0) return "n/a";
  return eth < 0.000001 ? eth.toExponential(2) : eth.toPrecision(3);
}
