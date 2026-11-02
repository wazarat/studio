"use client";

import { useEffect, useState } from "react";

import { connectionsAction } from "@/app/(app)/studio/strategies/actions";
import { Card, CardSection } from "@/components/ui/Card";
import { CONNECT_CLIENTS, connectInstructions, type ConnectClient } from "@/lib/mcp/connect";
import { cn } from "@/lib/utils";
import { formatAgo } from "@/lib/venues/format";

/**
 * The Connect card (step 6): pick an AI, copy one command or link, approve
 * in the browser, then watch the live "connected" line. One card per
 * server: the account's on the dashboard, a strategy's on its page.
 */
export interface ConnectionView {
  clientName: string;
  lastSeenAt: number;
  calls: number;
}

export function ConnectCard({ baseUrl, alias, path, server, initial }: { baseUrl: string; alias: string; path: string; server: string; initial: ConnectionView[] }) {
  const [client, setClient] = useState<ConnectClient>("claude-code");
  const [copied, setCopied] = useState(false);
  const [connections, setConnections] = useState<ConnectionView[]>(initial);
  const [now, setNow] = useState(() => Date.now());
  const instruction = connectInstructions(baseUrl, alias, path).find((i) => i.client === client)!;

  useEffect(() => {
    const t = setInterval(async () => {
      setNow(Date.now());
      const res = await connectionsAction(server);
      if (res.ok) setConnections(res.connections);
    }, 15_000);
    return () => clearInterval(t);
  }, [server]);

  const live = connections.filter((c) => now - c.lastSeenAt < 2 * 60_000);
  const copy = async () => {
    if (!instruction.copy) return;
    try {
      await navigator.clipboard.writeText(instruction.copy);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // The text stays selectable below.
    }
  };

  return (
    <Card>
      <CardSection className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-lg font-semibold text-ink-50">Connect an agent</h2>
          <p className={cn("text-xs", live.length ? "text-emerald-400 light:text-emerald-700" : "text-ink-400")}>
            {live.length
              ? `Connected · ${live.map((c) => c.clientName).join(", ")} · seen ${formatAgo(Math.max(...live.map((c) => c.lastSeenAt)), now)}`
              : connections.length
                ? `Last seen ${formatAgo(connections[0].lastSeenAt, now)} · ${connections[0].clientName}`
                : "Not connected yet"}
          </p>
        </div>
        <p className="text-xs text-ink-400">
          Server <span className="font-mono text-ink-200">{alias}</span>. The agent can read, backtest and propose; you accept changes and paper requests here. It cannot trade.
        </p>
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="AI client">
          {CONNECT_CLIENTS.map((c) => (
            <button
              key={c.id}
              type="button"
              role="radio"
              aria-checked={client === c.id}
              onClick={() => setClient(c.id)}
              className={cn("rounded-md border px-2.5 py-1 text-xs font-medium transition-colors", client === c.id ? "border-electric-500 bg-electric-500/10 text-electric-300" : "border-ink-700/60 bg-ink-900 text-ink-200 hover:border-ink-500 hover:text-ink-50")}
            >
              {c.label}
            </button>
          ))}
        </div>
        {instruction.copy ? (
          <div className="flex items-start gap-2">
            <pre className="min-w-0 flex-1 overflow-x-auto rounded-lg border border-ink-700/60 bg-ink-950/50 px-3 py-2 font-mono text-[11px] text-ink-100 light:bg-ink-900">{instruction.copy}</pre>
            {instruction.isLink ? (
              <a href={instruction.copy} className="shrink-0 rounded-lg border border-ink-700/60 px-3 py-2 text-xs text-ink-50 hover:bg-ink-800/40">
                Open
              </a>
            ) : (
              <button type="button" onClick={copy} className="shrink-0 rounded-lg border border-ink-700/60 px-3 py-2 text-xs text-ink-50 hover:bg-ink-800/40">
                {copied ? "Copied" : "Copy"}
              </button>
            )}
          </div>
        ) : null}
        <ol className="list-decimal space-y-0.5 pl-5 text-xs text-ink-300">
          {instruction.steps.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
      </CardSection>
    </Card>
  );
}
