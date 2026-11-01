"use client";

import dynamic from "next/dynamic";

/**
 * The charts load only in the browser: lightweight-charts needs a DOM
 * and a canvas, and this keeps it out of the server bundle and the
 * dashboard's chunk. The placeholder keeps the box the same height.
 */
function Skeleton() {
  return <div className="h-full w-full animate-pulse rounded-lg bg-ink-800/40" />;
}

export const PriceChart = dynamic(() => import("@/components/charts/PriceChart").then((m) => m.PriceChart), { ssr: false, loading: Skeleton });
export const EquityChart = dynamic(() => import("@/components/charts/EquityChart").then((m) => m.EquityChart), { ssr: false, loading: Skeleton });
