import "server-only";

import { auth, currentUser } from "@clerk/nextjs/server";

import { isOnboarded, readStudioMeta } from "@/lib/onboarding";

/** True when Clerk is configured at all. Without keys the auth pages fall back to placeholders. */
export function isAuthConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY);
}

export type OnboardingGate = "unconfigured" | "signed-out" | "onboard" | "ready";

/**
 * The one server-side check for /studio and /login. auth() throws
 * unless clerkMiddleware ran, and the middleware no-ops without keys, so the
 * config guard comes first. One Backend API call (currentUser) per request:
 * fine for two pages; a session claim can replace it once Studio grows.
 */
export async function getOnboardingGate(): Promise<OnboardingGate> {
  if (!isAuthConfigured()) return "unconfigured";
  const { userId } = await auth();
  if (!userId) return "signed-out";
  const user = await currentUser();
  return isOnboarded(readStudioMeta(user?.unsafeMetadata)) ? "ready" : "onboard";
}

export type InternalAdminGate = "unconfigured" | "signed-out" | "forbidden" | "admin";

function adminEmails(): Set<string> {
  return new Set(
    (process.env.INTERNAL_ADMIN_EMAILS ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

/**
 * The gate for /internal/* (Studio step 3): a comma-separated email
 * allowlist in INTERNAL_ADMIN_EMAILS, matched against the signed-in user's
 * verified addresses. Emails rather than Clerk ids because the Development
 * and production Clerk instances give one person different ids. Empty
 * allowlist means nobody.
 */
export async function getInternalAdminGate(): Promise<InternalAdminGate> {
  if (!isAuthConfigured()) return "unconfigured";
  const { userId } = await auth();
  if (!userId) return "signed-out";
  const allowed = adminEmails();
  if (allowed.size === 0) return "forbidden";
  const user = await currentUser();
  const verified = (user?.emailAddresses ?? [])
    .filter((e) => e.verification?.status === "verified")
    .map((e) => e.emailAddress.toLowerCase());
  return verified.some((e) => allowed.has(e)) ? "admin" : "forbidden";
}

/** For server actions and route handlers: throws unless the caller is an admin. */
export async function requireInternalAdmin(): Promise<void> {
  const gate = await getInternalAdminGate();
  if (gate !== "admin") throw new Error("Not allowed");
}
