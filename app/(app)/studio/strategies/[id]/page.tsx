import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";

import { Workspace } from "@/components/studio/Workspace";
import { getInternalAdminGate } from "@/lib/auth";
import { loginPathFor } from "@/lib/auth-paths";
import { loadPaperForStrategy } from "@/lib/paper/summary";
import { getStrategy } from "@/lib/strategies/db";
import { draftFromSpec } from "@/lib/strategies/draft";
import { cachedCandles, loadMarkets } from "@/lib/strategies/markets";

export const metadata: Metadata = { title: "Strategy", robots: { index: false } };
export const dynamic = "force-dynamic";

/** The workspace for a saved strategy: same component, loaded from the row. Owner and allowlist only. */
export default async function StrategyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const gate = await getInternalAdminGate();
  if (gate === "signed-out") redirect(loginPathFor(`/studio/strategies/${id}`));
  if (gate !== "admin") notFound();
  const { userId } = await auth();
  const row = userId && /^[0-9a-f-]{36}$/.test(id) ? await getStrategy(id, userId) : null;
  if (!row) notFound();

  const bundle = await loadMarkets();
  if (!bundle.markets.some((m) => m.id === row.spec.market.marketId)) notFound();
  const [candles, paper] = await Promise.all([
    cachedCandles(row.spec.market.marketId).catch(() => null),
    loadPaperForStrategy(row.ownerId, row.id, row.status, row.paperSince),
  ]);

  return (
    <Workspace
      markets={bundle.markets}
      prices={bundle.prices}
      changes={bundle.changes}
      initialDraft={draftFromSpec(row.spec)}
      initialCandles={candles}
      savedSpec={row.spec}
      initialPaper={paper}
    />
  );
}
