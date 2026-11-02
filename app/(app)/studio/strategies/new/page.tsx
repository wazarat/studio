import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { Workspace } from "@/components/studio/Workspace";
import { getInternalAdminGate, getMarketNames } from "@/lib/auth";
import { loginPathFor } from "@/lib/auth-paths";
import { newDraft } from "@/lib/strategies/draft";
import { cachedCandles, loadMarkets } from "@/lib/strategies/markets";
import { templateById } from "@/lib/strategies/templates";

export const metadata: Metadata = { title: "New strategy", robots: { index: false } };
export const dynamic = "force-dynamic";

/** The workspace for a new strategy, optionally seeded from a template. Allowlist only. */
export default async function NewStrategyPage({ searchParams }: { searchParams: Promise<{ template?: string }> }) {
  const gate = await getInternalAdminGate();
  if (gate === "signed-out") redirect(loginPathFor("/studio/strategies/new"));
  if (gate !== "admin") notFound();

  const { template: templateId } = await searchParams;
  const bundle = await loadMarkets();
  const template = templateById(templateId);
  const market =
    (template && (bundle.markets.find((m) => m.symbol === template.symbol) ?? bundle.markets.find((m) => m.category === template.category))) ??
    bundle.markets.find((m) => m.symbol === "BTC/USD") ??
    bundle.markets[0];
  if (!market) notFound();
  const draft = newDraft(market.id, template ? { entry: template.draft.entry, exit: { ...template.draft.exit }, size: { ...template.draft.size } } : {});
  const [candles, names] = await Promise.all([cachedCandles(market.id).catch(() => null), getMarketNames()]);

  return <Workspace markets={bundle.markets} prices={bundle.prices} changes={bundle.changes} initialDraft={draft} initialCandles={candles} savedSpec={null} initialPaper={null} initialNames={names} initialProposals={[]} initialConnections={[]} baseUrl={process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "") || "http://localhost:3000"} savedBacktest={null} />;
}
