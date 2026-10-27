import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { AuthCard, type AuthMode } from "@/components/auth/AuthCard";
import { Card, CardSection } from "@/components/ui/Card";
import { AUTH_COPY } from "@/content/auth";
import { STUDIO_COPY } from "@/content/studio";
import { getOnboardingGate } from "@/lib/auth";
import { STUDIO_PATH, safeRedirectPath } from "@/lib/auth-paths";

export const metadata: Metadata = { title: AUTH_COPY.logIn };
export const dynamic = "force-dynamic";

/**
 * Log in and sign up. On canhav.dev this was the signed-out view of /studio
 * with Clerk's prebuilt card; here the card is ours. A signed-in visitor is
 * sent on to the studio (or the page they were heading for).
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; redirect_url?: string }>;
}) {
  const { mode, redirect_url } = await searchParams;
  const gate = await getOnboardingGate();

  if (gate === "ready" || gate === "onboard") {
    const h = await headers();
    const proto = h.get("x-forwarded-proto") ?? "http";
    const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost";
    redirect(safeRedirectPath(redirect_url, `${proto}://${host}`) ?? STUDIO_PATH);
  }

  const initialMode: AuthMode = mode === "signup" ? "signup" : "login";

  return (
    <div className="container py-14 md:py-20">
      <div className="max-w-2xl">
        <h1 className="font-display text-4xl font-semibold tracking-tight text-ink-50 md:text-5xl">
          {STUDIO_COPY.kicker}
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-ink-300">{STUDIO_COPY.subtitle}</p>
      </div>
      <div className="mt-10">
        {gate === "unconfigured" ? (
          <Card className="max-w-md">
            <CardSection>
              <h2 className="font-display text-xl font-semibold tracking-tight text-ink-50">
                {AUTH_COPY.logInOrSignUp}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-ink-300">
                Sign-in is not configured. Set NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY,
                then reload.
              </p>
            </CardSection>
          </Card>
        ) : (
          <AuthCard initialMode={initialMode} redirectUrl={redirect_url ?? null} />
        )}
      </div>
    </div>
  );
}
