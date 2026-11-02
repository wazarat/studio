import { McpServer, createMcpHandler } from "@modelcontextprotocol/server";

import { registerAccountTools } from "@/lib/mcp/account-tools";
import { appOrigin, verifyMcpRequest } from "@/lib/mcp/auth";
import { accountDeps, registrarEnv } from "@/lib/mcp/deps";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * The account MCP server at /mcp (step 6): streamable HTTP, stateless,
 * one server built per request, every tool behind the Clerk OAuth gate.
 */
async function handle(req: Request) {
  const gate = await verifyMcpRequest(req, "/mcp");
  if (gate instanceof Response) return gate;
  const env = registrarEnv(appOrigin(req), "account");
  const deps = accountDeps();
  const handler = createMcpHandler(
    () => {
      const server = new McpServer({ name: "studio", version: "1.0.0" }, { instructions: "CanHav Studio: read Ostium markets, backtest strategy ideas and save drafts. Each saved strategy has its own server at /mcp/s/<id> for proposals and paper requests. Agents cannot trade or start anything; the user approves in Studio." });
      registerAccountTools(server, deps, env);
      return server;
    },
    { legacy: "stateless" },
  );
  return handler.fetch(req, { authInfo: gate.authInfo });
}

export const GET = handle;
export const POST = handle;
export const DELETE = handle;
