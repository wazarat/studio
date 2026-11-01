"use client";

import { ColorType, CrosshairMode, type DeepPartial, type ChartOptions } from "lightweight-charts";
import { useMemo } from "react";

import { useTheme } from "@/lib/theme";

/**
 * Chart colours from the app's own tokens (Studio step 4b). The CSS
 * variables hold rgb triplets; lightweight-charts wants rgb() strings, so
 * they are read from the document and re-read when the theme toggles.
 * Candles are the one place emerald and rose mean price, not status.
 */
export interface ChartColors {
  surface: string;
  text: string;
  grid: string;
  hairline: string;
  up: string;
  down: string;
  electric: string;
  neon: string;
  signal: string;
  muted: string;
  strong: string;
  rose: string;
}

export function rgbVar(name: string, alpha?: number): string {
  if (typeof document === "undefined") return alpha === undefined ? "rgb(0, 0, 0)" : `rgba(0, 0, 0, ${alpha})`;
  const raw = getComputedStyle(document.documentElement).getPropertyValue(`--${name}`).trim();
  const [r, g, b] = raw.split(/\s+/).map(Number);
  if (![r, g, b].every(Number.isFinite)) return alpha === undefined ? "rgb(128, 128, 128)" : `rgba(128, 128, 128, ${alpha})`;
  return alpha === undefined ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function readChartColors(theme: "dark" | "light"): ChartColors {
  return {
    surface: rgbVar("ink-900"),
    text: rgbVar("ink-300"),
    grid: rgbVar("ink-700", 0.4),
    hairline: rgbVar("ink-700", 0.6),
    up: theme === "light" ? "#059669" : "#34d399",
    down: rgbVar("rose-400"),
    electric: rgbVar("electric-400"),
    neon: rgbVar("neon-400"),
    signal: rgbVar("signal-400"),
    muted: rgbVar("ink-400"),
    strong: rgbVar("ink-100"),
    rose: rgbVar("rose-400"),
  };
}

export function useChartColors(): ChartColors {
  const theme = useTheme();
  return useMemo(() => readChartColors(theme), [theme]);
}

export function baseChartOptions(c: ChartColors): DeepPartial<ChartOptions> {
  return {
    autoSize: true,
    layout: {
      background: { type: ColorType.Solid, color: c.surface },
      textColor: c.text,
      fontFamily: "var(--font-sans), Inter, system-ui, sans-serif",
      fontSize: 11,
      attributionLogo: true,
      panes: { separatorColor: c.hairline, separatorHoverColor: c.grid, enableResize: false },
    },
    grid: { vertLines: { color: c.grid }, horzLines: { color: c.grid } },
    crosshair: { mode: CrosshairMode.Normal },
    rightPriceScale: { borderColor: c.hairline },
    timeScale: { borderColor: c.hairline, timeVisible: false, fixLeftEdge: true, rightOffset: 4 },
  };
}
