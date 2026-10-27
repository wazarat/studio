import * as React from "react";

import { cn } from "@/lib/utils";

export type StatusTone = "success" | "warning" | "error" | "info" | "neutral";

/**
 * Status as plain text (M137). The pill is an inline span of secondary
 * text, a clickable one a text link, the block a quiet paragraph. The tone
 * only colours error text, in rose; every other tone reads the same, so a
 * state has to say what it means in words. Kept as the renderer behind the
 * old call sites; new code writes the text itself, or uses MetaLine and
 * Property. Surface classes passed by older callers (padding, borders,
 * backgrounds, radii) are dropped so nothing draws a box again.
 */
const SURFACE = /^(-?(px|py|p|pl|pr|pt|pb|bg|border|rounded|shadow|ring)(-|$)|(sm|md|lg):(px|py|p|bg|border|rounded|shadow)(-|$))/;

function stripSurface(className?: string): string | undefined {
  if (!className) return className;
  return className
    .split(/\s+/)
    .filter((c) => c && !SURFACE.test(c))
    .join(" ");
}

export function StatusChip({
  tone = "neutral",
  variant = "pill",
  onClick,
  className,
  children,
  ...props
}: {
  tone?: StatusTone;
  variant?: "pill" | "block";
  onClick?: () => void;
} & React.HTMLAttributes<HTMLElement>) {
  const color = tone === "error" ? "text-rose-400" : variant === "block" ? "text-ink-300" : "text-ink-300";
  const rest = stripSurface(className);
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={cn("inline text-left text-xs underline-offset-2 transition-colors hover:text-ink-100 hover:underline", tone === "error" ? "text-rose-400" : "text-ink-200", rest)} {...props}>
        {children}
      </button>
    );
  }
  if (variant === "block") {
    return (
      <div className={cn("text-sm leading-relaxed", color, rest)} {...props}>
        {children}
      </div>
    );
  }
  return (
    <span className={cn("text-xs", color, rest)} {...props}>
      {children}
    </span>
  );
}
