import "server-only";

import { auth, clerkClient } from "@clerk/nextjs/server";
import { verifyClerkToken } from "@clerk/mcp-tools/server";
import type { AuthInfo } from "@modelcontextprotocol/server";

import { isAuthConfigured } from "@/lib/auth";
import type { McpCaller } from "@/lib/mcp/register";

/**
 * The MCP gate (step 6). A Clerk OAuth access token names the user; the
 * allowlist decides whether tools answer. Without a valid token the reply
 * is a 401 whose WWW-Authenticate header points at this path's protected
 * resource document, which is what sends an MCP client to Clerk's sign-in
 * and consent screen. Never returns the token to anyone.
 */
export interface McpGate {
  authInfo: AuthInfo;
  caller: McpCaller;
}

export function appOrigin(req: Request): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "");
  if (configured) return configured;
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "localhost:3000";
  return `${proto}://${host}`;
}

export function unauthorized(req: Request, path: string, description = "Sign in to Studio to use this server."): Response {
  const origin = appOrigin(req);
  const metadata = `${origin}/.well-known/oauth-protected-resource${path}`;
  return new Response(JSON.stringify({ error: "invalid_token", error_description: description }), {
    status: 401,
    headers: {
      "Content-Type": "application/json",
      "WWW-Authenticate": `Bearer error="invalid_token", error_description="${description}", resource_metadata="${metadata}", scope="profile email"`,
    },
  });
}

const adminCache = new Map<string, { at: number; admin: boolean }>();
const clientNameCache = new Map<string, { at: number; name: string }>();
const CACHE_MS = 60_000;

function allowlist(): Set<string> {
  return new Set((process.env.INTERNAL_ADMIN_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean));
}

async function isAdmin(userId: string): Promise<boolean> {
  const hit = adminCache.get(userId);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.admin;
  const allowed = allowlist();
  let admin = false;
  if (allowed.size > 0) {
    try {
      const user = await (await clerkClient()).users.getUser(userId);
      admin = user.emailAddresses.some((e) => e.verification?.status === "verified" && allowed.has(e.emailAddress.toLowerCase()));
    } catch {
      admin = false;
    }
  }
  adminCache.set(userId, { at: Date.now(), admin });
  return admin;
}

/** Clients that identify with a metadata document (CIMD) carry their name in it. */
const KNOWN_CIMD: Record<string, string> = {
  "https://claude.ai/oauth/claude-code-client-metadata": "Claude Code",
  "https://vscode.dev/oauth/client-metadata.json": "VS Code",
};

async function clientName(clientId: string): Promise<string> {
  const hit = clientNameCache.get(clientId);
  if (hit && Date.now() - hit.at < 10 * CACHE_MS) return hit.name;
  let name = "an MCP client";
  if (/^https?:\/\//.test(clientId)) {
    name = KNOWN_CIMD[clientId] ?? "";
    if (!name) {
      try {
        const res = await fetch(clientId, { signal: AbortSignal.timeout(4000), headers: { accept: "application/json" } });
        const doc = (await res.json()) as { client_name?: string };
        name = doc.client_name?.trim() || "";
      } catch {
        name = "";
      }
    }
    if (!name) {
      try {
        name = new URL(clientId).hostname.replace(/^www\./, "");
      } catch {
        name = "an MCP client";
      }
    }
  } else {
    try {
      const app = await (await clerkClient()).oauthApplications.get(clientId);
      if (app?.name) name = app.name;
    } catch {
      name = `client ${clientId.slice(0, 8)}`;
    }
  }
  clientNameCache.set(clientId, { at: Date.now(), name });
  return name;
}

/** The gate for one server path, for example "/mcp" or "/mcp/s/<id>". */
export async function verifyMcpRequest(req: Request, path: string): Promise<McpGate | Response> {
  if (!isAuthConfigured()) return new Response("Sign-in is not configured", { status: 503 });
  const header = req.headers.get("authorization") ?? "";
  const token = header.replace(/^Bearer\s+/i, "").trim() || undefined;
  if (!token) return unauthorized(req, path);
  let info: AuthInfo | undefined;
  try {
    const clerkAuth = await auth({ acceptsToken: "oauth_token" });
    info = verifyClerkToken(clerkAuth, token) as AuthInfo | undefined;
  } catch {
    info = undefined;
  }
  if (!info) return unauthorized(req, path, "The access token is missing, expired or not for this server.");
  const userId = String((info.extra as { userId?: string } | undefined)?.userId ?? "");
  if (!userId) return unauthorized(req, path);
  const [admin, name] = await Promise.all([isAdmin(userId), clientName(info.clientId)]);
  const caller: McpCaller = { userId, clientId: info.clientId, clientName: name, admin };
  return { authInfo: { ...info, extra: { ...info.extra, ...caller, token: undefined } }, caller };
}
