import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { StrategyForm } from "@/components/studio/StrategyForm";
import { getInternalAdminGate } from "@/lib/auth";
import { loginPathFor } from "@/lib/auth-paths";
import { ostium } from "@/lib/venues/ostium";

export const metadata: Metadata = { title: "New strategy", robots: { index: false } };
export const dynamic = "force-dynamic";

/** The New strategy form (step 4), allowlist only; a 404 for anyone else. */
export default async function NewStrategyPage() {
  const gate = await getInternalAdminGate();
  if (gate === "signed-out") redirect(loginPathFor("/studio/strategies/new"));
  if (gate !== "admin") notFound();

  const markets = (await ostium.markets()).map((m) => ({
    id: m.id,
    symbol: m.symbol,
    category: m.category,
    maxLeverage: m.limits.maxLeverage,
    overnightMaxLeverage: m.limits.overnightMaxLeverage,
    openBps: m.fees.openBps,
    isOpen: m.hours.isOpen,
  }));

  return (
    <div className="container py-10 md:py-14">
      <p className="kicker">Studio</p>
      <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight text-ink-50 md:text-4xl">New strategy</h1>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-400">
        Long only, decided on each daily candle close. Saving runs the risk checker against the live market, then
        backtests the strategy over the venue&apos;s whole daily history with fees and rollover.
      </p>
      <StrategyForm markets={markets} />
    </div>
  );
}
