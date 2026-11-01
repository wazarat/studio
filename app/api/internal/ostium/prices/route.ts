import { compareToReference, type PriceComparison } from "@/lib/chainlink/compare";
import { readReferences, symbolsWithFeeds, toleranceBps } from "@/lib/chainlink/read";
import { getInternalAdminGate } from "@/lib/auth";
import { ostium } from "@/lib/venues/ostium";
import type { Price } from "@/lib/venues/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const REFERENCE_EVERY_MS = 15_000;

/**
 * Server-sent events for the internal page: Ostium ticks straight from the
 * venue's price stream, and every 15 s a fresh Chainlink comparison for the
 * markets that have a feed, using the latest tick as the venue side. The
 * browser's EventSource reconnects on its own when the function's time is
 * up. Allowlisted admins only; anyone else gets a 404 like the page.
 */
export async function GET(req: Request) {
  if ((await getInternalAdminGate()) !== "admin") return new Response(null, { status: 404 });

  const markets = await ostium.markets();
  const latest = new Map<string, Price>();
  const encoder = new TextEncoder();
  let cleanup: () => void = () => {};

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      const send = (event: string, data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          closed = true;
        }
      };

      const unsubscribe = ostium.subscribePrices(
        markets.map((m) => m.id),
        (price) => {
          latest.set(price.marketId, price);
          send("price", price);
        },
      );

      const feedSymbols = symbolsWithFeeds(markets.map((m) => m.symbol));
      const bySymbol = new Map(markets.map((m) => [m.symbol, m.id]));
      const tolerance = toleranceBps();
      const pushReferences = async () => {
        try {
          const readings = await readReferences(feedSymbols);
          const comparisons: PriceComparison[] = [];
          for (const [symbol, reading] of readings) {
            const id = bySymbol.get(symbol);
            const price = id ? latest.get(id) : undefined;
            if (price) comparisons.push(compareToReference(price.mid, reading, tolerance));
          }
          send("reference", { comparisons, at: Date.now() });
        } catch (error) {
          send("status", { error: error instanceof Error ? error.message : String(error) });
        }
      };
      // The first comparison waits for the stream's snapshot.
      const first = setTimeout(pushReferences, 3_000);
      const references = setInterval(pushReferences, REFERENCE_EVERY_MS);
      const heartbeat = setInterval(() => {
        if (!closed) {
          try {
            controller.enqueue(encoder.encode(": keep-alive\n\n"));
          } catch {
            closed = true;
          }
        }
      }, REFERENCE_EVERY_MS);

      cleanup = () => {
        if (closed) return;
        closed = true;
        clearTimeout(first);
        clearInterval(references);
        clearInterval(heartbeat);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // already closed by the client
        }
      };
      req.signal.addEventListener("abort", cleanup);
      send("status", { connected: true, markets: markets.length, feeds: feedSymbols.length });
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
