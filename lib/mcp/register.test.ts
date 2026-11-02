import { describe, expect, it } from "vitest";
import { z } from "zod";

import { annotationsFor, INVITE_ONLY, memoryRateLimiter, RATE_LIMITS, runTool, type McpCaller, type RegistrarEnv } from "@/lib/mcp/register";

const caller: McpCaller = { userId: "u1", clientId: "c1", clientName: "Claude Code", admin: true };
const env = (now = 0): RegistrarEnv => ({ limiter: memoryRateLimiter(), appUrl: "https://studio.test", now: () => now });
const echo = { name: "echo", title: "Echo", description: "", input: z.object({ n: z.number().int().min(1) }), kind: "read" as const };

describe("annotations", () => {
  it("mark reads read-only and writes non-destructive", () => {
    expect(annotationsFor("read")).toEqual({ readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false });
    expect(annotationsFor("write")).toEqual({ readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false });
  });
});

describe("runTool", () => {
  it("answers field by field on bad input and wraps results", async () => {
    const bad = await runTool(echo, async (a) => a, env(), { n: 0 }, caller);
    expect(bad.isError).toBe(true);
    expect(bad.content[0].text).toMatch(/^n: /);
    const ok = await runTool(echo, async (a) => ({ doubled: a.n * 2 }), env(), { n: 2 }, caller);
    expect(ok.isError).toBeUndefined();
    expect(ok.structuredContent).toEqual({ doubled: 4 });
  });

  it("refuses unsigned and non-allowlisted callers without running the handler", async () => {
    let ran = false;
    const handler = async () => {
      ran = true;
      return {};
    };
    expect((await runTool(echo, handler, env(), { n: 1 }, null)).isError).toBe(true);
    const outsider = await runTool(echo, handler, env(), { n: 1 }, { ...caller, admin: false });
    expect(outsider.content[0].text).toBe(INVITE_ONLY);
    expect(ran).toBe(false);
  });

  it("rate limits per user per minute, and heavy tools tighter", async () => {
    const limiter = memoryRateLimiter();
    const e: RegistrarEnv = { limiter, appUrl: "https://studio.test", now: () => 1_000_000 };
    for (let i = 0; i < RATE_LIMITS.perMinute; i++) expect((await runTool(echo, async () => ({}), e, { n: 1 }, caller)).isError).toBeUndefined();
    const over = await runTool(echo, async () => ({}), e, { n: 1 }, caller);
    expect(over.isError).toBe(true);
    expect(over.content[0].text).toMatch(/Rate limit/);
    // Another user is unaffected; the window clears after a minute.
    expect((await runTool(echo, async () => ({}), e, { n: 1 }, { ...caller, userId: "u2" })).isError).toBeUndefined();
    const later: RegistrarEnv = { ...e, now: () => 1_000_000 + 61_000 };
    expect((await runTool(echo, async () => ({}), later, { n: 1 }, caller)).isError).toBeUndefined();
    const heavy = { ...echo, name: "run_backtest" };
    const h: RegistrarEnv = { limiter: memoryRateLimiter(), appUrl: "x", now: () => 5 };
    for (let i = 0; i < RATE_LIMITS.heavyPerMinute; i++) expect((await runTool(heavy, async () => ({}), h, { n: 1 }, caller)).isError).toBeUndefined();
    expect((await runTool(heavy, async () => ({}), h, { n: 1 }, caller)).isError).toBe(true);
  });
});
