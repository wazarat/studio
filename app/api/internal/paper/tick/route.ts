import { NextResponse } from "next/server";

import { getInternalAdminGate } from "@/lib/auth";
import { runPaperTick } from "@/lib/paper/tick";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * The paper tick endpoint (Studio step 5). Vercel's cron calls it with
 * `Authorization: Bearer CRON_SECRET` every five minutes; an allowlisted
 * admin session may call it too. Anyone else gets a 404, like the rest
 * of /api/internal.
 */
async function authorised(req: Request): Promise<boolean> {
  const secret = process.env.CRON_SECRET?.trim();
  if (secret && req.headers.get("authorization") === `Bearer ${secret}`) return true;
  try {
    return (await getInternalAdminGate()) === "admin";
  } catch {
    return false;
  }
}

export async function GET(req: Request) {
  if (!(await authorised(req))) return new NextResponse(null, { status: 404 });
  const report = await runPaperTick();
  return NextResponse.json(report);
}

export const POST = GET;
