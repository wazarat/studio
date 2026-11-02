import "server-only";

import { getDb } from "@/lib/db";

/**
 * Who is connected over MCP (step 6): one row per account, client and
 * server, touched on every call but written at most once a minute per
 * instance. "Connected" on the card means seen within two minutes.
 */
export interface McpConnection {
  clientId: string;
  clientName: string;
  server: string;
  firstSeenAt: number;
  lastSeenAt: number;
  calls: number;
}

export const CONNECTED_WITHIN_MS = 2 * 60 * 1000;

const lastWrite = new Map<string, number>();
const pendingCalls = new Map<string, number>();

export function touchConnection(ownerId: string, clientId: string, clientName: string, server: string): void {
  const key = `${ownerId}:${clientId}:${server}`;
  pendingCalls.set(key, (pendingCalls.get(key) ?? 0) + 1);
  const now = Date.now();
  if (now - (lastWrite.get(key) ?? 0) < 60_000) return;
  lastWrite.set(key, now);
  const sql = getDb();
  if (!sql) return;
  const calls = pendingCalls.get(key) ?? 1;
  pendingCalls.set(key, 0);
  void sql`
    insert into studio.mcp_connections (owner_id, client_id, client_name, server, calls)
    values (${ownerId}, ${clientId}, ${clientName}, ${server}, ${calls})
    on conflict (owner_id, client_id, server) do update
      set last_seen_at = now(), client_name = excluded.client_name, calls = studio.mcp_connections.calls + excluded.calls`.catch(() => {
    lastWrite.delete(key);
  });
}

export async function listConnections(ownerId: string, server?: string): Promise<McpConnection[]> {
  const sql = getDb();
  if (!sql) return [];
  const rows = server
    ? await sql`select * from studio.mcp_connections where owner_id = ${ownerId} and server = ${server} order by last_seen_at desc`
    : await sql`select * from studio.mcp_connections where owner_id = ${ownerId} order by last_seen_at desc`;
  return rows.map((r) => ({
    clientId: String(r.client_id),
    clientName: String(r.client_name ?? "an MCP client"),
    server: String(r.server),
    firstSeenAt: new Date(r.first_seen_at as string).getTime(),
    lastSeenAt: new Date(r.last_seen_at as string).getTime(),
    calls: Number(r.calls),
  }));
}
