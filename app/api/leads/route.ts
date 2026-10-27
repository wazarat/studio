import { NextResponse } from "next/server";
import { z } from "zod";

import { SOLUTION_KEYS } from "@/content/studio-pro";

export const runtime = "nodejs";

/**
 * Lead capture for the contact modal. On canhav.dev an accepted lead is
 * written to the database and emailed through Resend. Neither is connected
 * in Studio yet, so this route validates the payload the same way and then
 * answers that the form is not connected. The modal shows that message.
 */

const LeadSchema = z
  .object({
    kind: z.enum(["contact"]).default("contact"),
    fullName: z.string().trim().min(1).max(120).optional(),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .max(254)
      .pipe(z.email({ message: "Please enter a valid email address." })),
    leadType: z.enum(["individual", "team"]).optional(),
    /** Keys from STUDIO_PRO_SOLUTIONS. */
    solutions: z.array(z.enum(SOLUTION_KEYS)).max(9).default([]),
    comments: z.string().trim().max(2000).default(""),
    sourcePage: z.string().trim().max(64).default("unknown"),
    website: z.string().max(500).default(""), // honeypot — humans never see it
  })
  .refine((d) => Boolean(d.fullName && d.leadType), {
    message: "Name and lead type are required.",
  });

const NOT_CONNECTED_MESSAGE =
  "The contact form is not connected yet. Email us or book a call at meet.canhav.com.";

export async function POST(req: Request) {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const parsed = LeadSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = issue?.path[0];
    const message = field
      ? `Check the ${String(field)} field. ${issue.message}`
      : (issue?.message ?? "Invalid payload.");
    return NextResponse.json({ error: message }, { status: 400 });
  }

  // Bots fill the hidden field; pretend it worked and drop the payload.
  if (parsed.data.website) return NextResponse.json({ ok: true });

  return NextResponse.json({ error: NOT_CONNECTED_MESSAGE }, { status: 503 });
}
