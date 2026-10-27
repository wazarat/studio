"use client";

import { Moon, Sun } from "lucide-react";

import { applyTheme, useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

const LABEL = {
  toLight: "Switch to light mode",
  toDark: "Switch to dark mode",
} as const;

/**
 * The app shell's theme switch: a round icon button the size of the
 * avatar. Before hydration useTheme reads "dark", which matches the server
 * markup; the inline ThemeScript has already set the real class.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const theme = useTheme();
  const next = theme === "dark" ? "light" : "dark";
  const label = next === "light" ? LABEL.toLight : LABEL.toDark;
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={() => applyTheme(next)}
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-full border border-ink-700/60 bg-ink-900 text-ink-300 transition-colors hover:border-ink-500 hover:text-ink-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-500/60",
        className,
      )}
    >
      {theme === "dark" ? <Sun aria-hidden className="h-4 w-4" /> : <Moon aria-hidden className="h-4 w-4" />}
    </button>
  );
}
