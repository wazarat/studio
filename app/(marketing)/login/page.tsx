import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { SignInCard } from "@/components/auth/SignInCard";
import { SignUpCard } from "@/components/auth/SignUpCard";
import { Card, CardSection } from "@/components/ui/Card";
import { AUTH_COPY } from "@/content/auth";
import { STUDIO_COPY } from "@/content/studio";
import { getOnboardingGate } from "@/lib/auth";
import { STUDIO_PATH, safeRedirectPath } from "@/lib/auth-paths";

export const metadata: Metadata = { title: AUTH_COPY.signIn };
export const dynamic = "force-dynamic";

/**
 * Log in (the default) and sign up (?mode=signup), with Clerk's prebuilt
 * cards as on canhav.com. Log in sits under the Studio heading the way the
 * signed-out studio did; sign up gets its own heading. A signed-in visitor
 * is sent on to the studio, or the page they were heading for.
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

  const signup = mode === "signup";

  return (
    <div className="container py-14 md:py-20">
      <div className="max-w-2xl">
        {signup ? (
          <>
            <p className="kicker">{AUTH_COPY.signUpKicker}</p>
            <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight text-ink-50 md:text-5xl">
              {AUTH_COPY.signUpTitle}
            </h1>
            <p className="mt-4 text-sm leading-relaxed text-ink-400">{AUTH_COPY.signUpLead}</p>
          </>
        ) : (
          <>
            <h1 className="font-display text-4xl font-semibold tracking-tight text-ink-50 md:text-5xl">
              {STUDIO_COPY.kicker}
            </h1>
            <p className="mt-4 text-lg leading-relaxed text-ink-300">{STUDIO_COPY.subtitle}</p>
          </>
        )}
      </div>
      <div className="mt-10 md:mt-12">
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
        ) : signup ? (
          <SignUpCard />
        ) : (
          <SignInCard />
        )}
      </div>
    </div>
  );
}
