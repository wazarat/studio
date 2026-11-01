/**
 * Formatting for venue numbers on the internal page. Deterministic (en-US)
 * so server render and hydration agree, like lib/format.ts.
 */

export function formatPrice(value: number): string {
  if (!Number.isFinite(value) || value === 0) return "–";
  const abs = Math.abs(value);
  const digits = abs >= 1000 ? 2 : abs >= 1 ? 4 : 6;
  return value.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function formatUsd(value: number, digits = 2): string {
  if (!Number.isFinite(value)) return "–";
  return `$${value.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}

export function formatUsdCompact(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `$${(value / 1e3).toFixed(1)}K`;
  return formatUsd(value, 0);
}

export function formatBps(value: number): string {
  if (!Number.isFinite(value)) return "–";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)} bps`;
}

/** "12 seconds ago", "3 minutes ago", "2 hours ago". */
export function formatAgo(ms: number, nowMs: number): string {
  const s = Math.max(0, Math.round((nowMs - ms) / 1000));
  if (s < 60) return `${s} second${s === 1 ? "" : "s"} ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} minute${m === 1 ? "" : "s"} ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h} hour${h === 1 ? "" : "s"} ago`;
  return `${Math.round(h / 24)} days ago`;
}

/** "2h 15m" / "40m" / "now". */
export function formatCountdown(seconds: number | null): string {
  if (seconds === null || seconds < 0) return "";
  if (seconds < 60) return "under a minute";
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
