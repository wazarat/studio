import type { McpServer, ServerContext, ToolAnnotations } from "@modelcontextprotocol/server";
import type { z } from "zod";

/**
 * How every Studio MCP tool is registered (step 6). The wrapper checks the
 * input with zod and answers field by field, applies the per-user rate
 * limit, tells the caller who they are, and shapes every answer. Pure, so
 * the tests register tools against a fake server.
 */

export type ToolKind = "read" | "write";

export interface McpCaller {
  userId: string;
  clientId: string;
  clientName: string;
  /** On the allowlist. Others get a plain refusal from every tool. */
  admin: boolean;
}

export interface ToolResult {
  content: { type: "text"; text: string }[];
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
}

export const RATE_LIMITS = {
  /** Tool calls per user per minute. */
  perMinute: 60,
  /** Backtests, strategy creation and proposals per user per minute. */
  heavyPerMinute: 10,
} as const;

export const HEAVY_TOOLS = new Set(["run_backtest", "create_strategy", "propose_change"]);

export interface RateLimiter {
  /** Returns the seconds to wait, or 0 when the call may go ahead. */
  take(userId: string, tool: string, nowMs: number): number;
}

/** A sliding one-minute window per user, in memory for this instance. */
export function memoryRateLimiter(limits: typeof RATE_LIMITS = RATE_LIMITS): RateLimiter {
  const calls = new Map<string, number[]>();
  const heavy = new Map<string, number[]>();
  const check = (map: Map<string, number[]>, key: string, limit: number, nowMs: number) => {
    const list = (map.get(key) ?? []).filter((t) => nowMs - t < 60_000);
    if (list.length >= limit) {
      map.set(key, list);
      return Math.ceil((60_000 - (nowMs - list[0])) / 1000);
    }
    list.push(nowMs);
    map.set(key, list);
    return 0;
  };
  return {
    take(userId, tool, nowMs) {
      const wait = check(calls, userId, limits.perMinute, nowMs);
      if (wait > 0) return wait;
      return HEAVY_TOOLS.has(tool) ? check(heavy, userId, limits.heavyPerMinute, nowMs) : 0;
    },
  };
}

export interface RegistrarEnv {
  limiter: RateLimiter;
  /** The app's base URL for links in answers, no trailing slash. */
  appUrl: string;
  /** Called after every accepted call; the Neon one records the connection. */
  onCall?: (caller: McpCaller, tool: string) => void;
  now?: () => number;
}

export function annotationsFor(kind: ToolKind, override: Partial<ToolAnnotations> = {}): ToolAnnotations {
  return kind === "read"
    ? { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false, ...override }
    : { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false, ...override };
}

export function jsonResult(value: unknown): ToolResult {
  const text = JSON.stringify(value, null, 2);
  return { content: [{ type: "text", text }], structuredContent: value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : { value } };
}

export function errorResult(message: string): ToolResult {
  return { content: [{ type: "text", text: message }], isError: true };
}

export class ToolError extends Error {}

export interface ToolDef<S extends z.ZodTypeAny> {
  name: string;
  title: string;
  description: string;
  input: S;
  kind: ToolKind;
  annotations?: Partial<ToolAnnotations>;
}

export type ToolHandler<S extends z.ZodTypeAny> = (args: z.infer<S>, caller: McpCaller) => Promise<unknown>;

export function callerOf(ctx: ServerContext | undefined): McpCaller | null {
  const extra = ctx?.http?.authInfo?.extra as Partial<McpCaller> | undefined;
  if (!extra || typeof extra.userId !== "string") return null;
  return {
    userId: extra.userId,
    clientId: typeof extra.clientId === "string" ? extra.clientId : String(ctx?.http?.authInfo?.clientId ?? "unknown"),
    clientName: typeof extra.clientName === "string" ? extra.clientName : "an MCP client",
    admin: extra.admin === true,
  };
}

export const INVITE_ONLY = "Studio is invite-only right now. Your account is signed in but not on the allowlist.";

function describeIssues(error: z.ZodError): string {
  return error.issues.map((i) => `${i.path.join(".") || "input"}: ${i.message}`).join(" ");
}

/** The runner behind every tool, kept apart so tests can call it without an McpServer. */
export async function runTool<S extends z.ZodTypeAny>(def: ToolDef<S>, handler: ToolHandler<S>, env: RegistrarEnv, rawArgs: unknown, caller: McpCaller | null): Promise<ToolResult> {
  if (!caller) return errorResult("Not signed in. Connect this server with your Studio account first.");
  if (!caller.admin) return errorResult(INVITE_ONLY);
  const now = env.now?.() ?? Date.now();
  const wait = env.limiter.take(caller.userId, def.name, now);
  if (wait > 0) return errorResult(`Rate limit: try again in ${wait} seconds.`);
  const parsed = def.input.safeParse(rawArgs ?? {});
  if (!parsed.success) return errorResult(describeIssues(parsed.error));
  env.onCall?.(caller, def.name);
  const started = Date.now();
  try {
    const value = await handler(parsed.data, caller);
    console.log(JSON.stringify({ mcpTool: def.name, userId: caller.userId, client: caller.clientName, ms: Date.now() - started }));
    return jsonResult(value);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log(JSON.stringify({ mcpTool: def.name, userId: caller.userId, client: caller.clientName, ms: Date.now() - started, error: message }));
    return errorResult(message);
  }
}

export function registerTool<S extends z.ZodTypeAny>(server: McpServer, def: ToolDef<S>, handler: ToolHandler<S>, env: RegistrarEnv): void {
  server.registerTool(
    def.name,
    {
      title: def.title,
      description: def.description,
      inputSchema: def.input as unknown as Parameters<McpServer["registerTool"]>[1]["inputSchema"],
      annotations: annotationsFor(def.kind, def.annotations),
    },
    (async (args: unknown, ctx: ServerContext) => runTool(def, handler, env, args, callerOf(ctx))) as unknown as Parameters<McpServer["registerTool"]>[2],
  );
}
