import { formatDayShort } from "@/lib/format";

interface BarChartProps {
  points: Array<{ date: string; value: number }>;
  /** Emphasize the final bar (the latest completed day). */
  highlightLast?: boolean;
  ariaLabel: string;
}

const VIEW_W = 560;
const VIEW_H = 180;
const GAP_RATIO = 0.28;

/**
 * Minimal rounded-bar chart in the site palette. Pure SVG, no client JS —
 * tooltips are native <title> elements.
 */
export function BarChart({ points, highlightLast = true, ariaLabel }: BarChartProps) {
  if (points.length === 0) {
    return (
      <div className="flex h-[180px] items-center justify-center rounded-xl border border-ink-800/60 bg-ink-950/40">
        <p className="text-xs text-ink-400">Chart data unavailable</p>
      </div>
    );
  }

  const max = Math.max(...points.map((p) => p.value), 1);
  const slot = VIEW_W / points.length;
  const barW = Math.min(slot * (1 - GAP_RATIO), 34);
  const radius = Math.min(barW / 2, 5);
  const first = points[0];
  const last = points[points.length - 1];

  return (
    <div className="space-y-2">
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        role="img"
        aria-label={ariaLabel}
        className="block w-full"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="bar-muted" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3D7BFF" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0.18" />
          </linearGradient>
          <linearGradient id="bar-hot" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#5C92FF" />
            <stop offset="100%" stopColor="#8B5CF6" />
          </linearGradient>
        </defs>
        {points.map((p, i) => {
          const h = Math.max((p.value / max) * (VIEW_H - 8), 3);
          const x = i * slot + (slot - barW) / 2;
          const y = VIEW_H - h;
          const hot = highlightLast && i === points.length - 1;
          return (
            <rect
              key={p.date}
              x={x}
              y={y}
              width={barW}
              height={h}
              rx={radius}
              fill={hot ? "url(#bar-hot)" : "url(#bar-muted)"}
              className={hot ? "drop-shadow-[0_0_10px_rgba(92,146,255,0.55)]" : undefined}
            >
              <title>{`${formatDayShort(p.date)} · ${p.value.toLocaleString("en-US")}`}</title>
            </rect>
          );
        })}
      </svg>
      <div className="flex justify-between font-mono text-[10px] text-ink-400">
        <span>{formatDayShort(first.date)}</span>
        {points.length > 4 && <span>{formatDayShort(points[Math.floor(points.length / 2)].date)}</span>}
        <span>{formatDayShort(last.date)}</span>
      </div>
    </div>
  );
}
