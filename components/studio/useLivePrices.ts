"use client";

import { useEffect, useState } from "react";

import type { Price } from "@/lib/venues/types";

export type StreamState = "off" | "connecting" | "live" | "retrying";

/**
 * Live Ostium prices over the internal SSE route (Studio step 4b). One
 * EventSource per mount, price events only; the browser reconnects on
 * its own when the route's time is up. Never opened when disabled, since
 * the route answers 404 outside the allowlist.
 */
export function useLivePrices(initial: Price[], enabled: boolean) {
  const [prices, setPrices] = useState<Record<string, Price>>(() => Object.fromEntries(initial.map((p) => [p.marketId, p])));
  const [state, setState] = useState<StreamState>(enabled ? "connecting" : "off");
  const [lastTickAt, setLastTickAt] = useState<number | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const es = new EventSource("/api/internal/ostium/prices");
    es.addEventListener("price", (e) => {
      const price = JSON.parse((e as MessageEvent).data) as Price;
      setPrices((prev) => ({ ...prev, [price.marketId]: price }));
      setLastTickAt(Date.now());
      setState("live");
    });
    es.onerror = () => setState("retrying");
    return () => es.close();
  }, [enabled]);

  return { prices, state, lastTickAt };
}
