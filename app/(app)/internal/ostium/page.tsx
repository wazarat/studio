import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { OstiumConsole } from "@/components/internal/OstiumConsole";
import { getInternalAdminGate } from "@/lib/auth";
import { loginPathFor } from "@/lib/auth-paths";
import { compareToReference, type PriceComparison } from "@/lib/chainlink/compare";
import { readReferences, toleranceBps } from "@/lib/chainlink/read";
import { getDevSigner } from "@/lib/signers/dev";
import { builderConfig, isTestnet, ostium } from "@/lib/venues/ostium";
import type { Market, Price } from "@/lib/venues/types";

export const metadata: Metadata = { title: "Ostium", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const INTERNAL_PATH = "/internal/ostium";

/**
 * The internal Ostium console (Studio step 3): every market with its live
 * price next to Chainlink, a trade preview run through the risk checker,
 * and, on testnet with a dev key, the test-trade buttons. Allowlisted
 * admins only; everyone else sees a 404, and nothing links here.
 */
export default async function InternalOstiumPage() {
  const gate = await getInternalAdminGate();
  if (gate === "signed-out") redirect(loginPathFor(INTERNAL_PATH));
  if (gate !== "admin") notFound();

  let markets: Market[] = [];
  let prices: Price[] = [];
  let loadError: string | null = null;
  try {
    [markets, prices] = await Promise.all([ostium.markets(), ostium.prices()]);
  } catch (error) {
    loadError = error instanceof Error ? error.message : String(error);
  }

  let comparisons: PriceComparison[] = [];
  let referenceError: string | null = null;
  if (markets.length > 0) {
    try {
      const readings = await readReferences(markets.map((m) => m.symbol));
      const midBySymbol = new Map(prices.map((p) => [p.symbol, p.mid]));
      comparisons = Array.from(readings.values()).map((r) =>
        compareToReference(midBySymbol.get(r.symbol) ?? 0, r, toleranceBps()),
      );
    } catch (error) {
      referenceError = error instanceof Error ? error.message : String(error);
    }
  }

  let devSignerAddress: string | null = null;
  let signerError: string | null = null;
  try {
    devSignerAddress = getDevSigner()?.address ?? null;
  } catch (error) {
    signerError = error instanceof Error ? error.message : String(error);
  }

  return (
    <OstiumConsole
      testnet={isTestnet()}
      builderAddress={builderConfig()?.address ?? null}
      toleranceBps={toleranceBps()}
      devSignerAddress={devSignerAddress}
      signerError={signerError}
      initial={{ markets, prices, comparisons, loadError, referenceError, at: Date.now() }}
    />
  );
}
