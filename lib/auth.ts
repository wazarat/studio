import "server-only";

import { auth, currentUser } from "@clerk/nextjs/server";

import { isOnboarded, readStudioMeta } from "@/lib/onboarding";

/** True when Clerk is configured at all. Without keys the auth pages fall back to placeholders. */
export function isAuthConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY);
}

export type OnboardingGate = "unconfigured" | "signed-out" | "onboard" | "ready";

/**
 * The one server-side check for /studio, /welcome and /login. auth() throws
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
