import { McpServer, createMcpHandler } from "@modelcontextprotocol/server";

import { appOrigin, verifyMcpRequest } from "@/lib/mcp/auth";
import { serverAlias } from "@/lib/mcp/connect";
import { registrarEnv, strategyDeps } from "@/lib/mcp/deps";
import { registerStrategyTools } from "@/lib/mcp/strategy-tools";
import { getStrategy } from "@/lib/strategies/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * One strategy's MCP server at /mcp/s/<id> (step 6). The id in the URL
 * picks the tools; ownership is checked on every call, and the server
 * name carries the strategy's name so several can be connected at once.
 */
async function handle(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: raw } = await params;
  if (!UUID.test(raw)) return new Response("Not found", { status: 404 });
  const id = raw.toLowerCase();
  const gate = await verifyMcpRequest(req, `/mcp/s/${id}`);
  if (gate instanceof Response) return gate;
  const row = gate.caller.admin ? await getStrategy(id, gate.caller.userId).catch(() => null) : null;
  const env = registrarEnv(appOrigin(req), id);
  const deps = strategyDeps();
  const handler = createMcpHandler(
    () => {
      const server = new McpServer(
        { name: serverAlias(row?.name, id), version: "1.0.0" },
        { instructions: `Studio strategy${row ? ` "${row.name}" on ${row.symbol}` : ""}: read its spec, backtest, paper results and positions; propose changes and paper requests for the user to approve. Nothing here edits, trades, starts or stops anything on its own.` },
      );
      registerStrategyTools(server, id, deps, env);
      return server;
    },
    { legacy: "stateless" },
  );
  return handler.fetch(req, { authInfo: gate.authInfo });
}

export const GET = handle;
export const POST = handle;
export const DELETE = handle;
