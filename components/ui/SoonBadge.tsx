import { Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * The "coming soon" pill for launch-sequence surfaces (nav, studio track
 * cards): a hairline gradient border over a translucent ink fill, with a
 * small spark glyph. Not a status surface (no live state), so it is not a
 * StatusChip; distinct from the generic Badge on purpose.
 */
const ACCENT_STYLES = {
  electric: {
    ring: "[background:linear-gradient(180deg,rgb(var(--ink-900)/0.92),rgb(var(--ink-900)/0.92))_padding-box,linear-gradient(120deg,rgba(92,146,255,0.7),rgba(167,139,250,0.55))_border-box]",
    icon: "text-electric-400",
  },
  neon: {
    ring: "[background:linear-gradient(180deg,rgb(var(--ink-900)/0.92),rgb(var(--ink-900)/0.92))_padding-box,linear-gradient(120deg,rgba(167,139,250,0.7),rgba(92,146,255,0.45))_border-box]",
    icon: "text-neon-400",
  },
  signal: {
    ring: "[background:linear-gradient(180deg,rgb(var(--ink-900)/0.92),rgb(var(--ink-900)/0.92))_padding-box,linear-gradient(120deg,rgba(34,211,238,0.65),rgba(92,146,255,0.45))_border-box]",
    icon: "text-signal-400",
  },
} as const;

export function SoonBadge({
  label = "Coming soon",
  accent = "electric",
  className,
}: {
  label?: string;
  accent?: keyof typeof ACCENT_STYLES;
  className?: string;
}) {
  const styles = ACCENT_STYLES[accent];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-md border border-transparent px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em] text-ink-200",
        styles.ring,
        className,
      )}
    >
      <Sparkles aria-hidden className={cn("h-3 w-3", styles.icon)} />
      {label}
    </span>
  );
}
