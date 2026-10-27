import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { StudioOnboarding } from "@/components/studio/StudioOnboarding";
import { Card, CardSection } from "@/components/ui/Card";
import { STUDIO_COPY } from "@/content/studio";
import { getOnboardingGate } from "@/lib/auth";
import { STUDIO_PATH, loginPathFor } from "@/lib/auth-paths";

export const metadata: Metadata = { title: STUDIO_COPY.kicker, robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * The signed-in home. For now the heading and subtitle only: projects,
 * templates and the new-project flow come over from canhav.dev in a later
 * step. An account that has not finished signing up gets the steps as a
 * pop-up over this page.
 */
export default async function StudioPage() {
  const gate = await getOnboardingGate();
  if (gate === "signed-out") redirect(loginPathFor(STUDIO_PATH));

  return (
    <div className="container py-14 md:py-20">
      <div className="max-w-2xl">
        <h1 className="font-display text-4xl font-semibold tracking-tight text-ink-50 md:text-5xl">
          {STUDIO_COPY.kicker}
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-ink-300">{STUDIO_COPY.subtitle}</p>
      </div>
      {gate === "unconfigured" ? (
        <Card className="mt-10 max-w-md">
          <CardSection>
            <p className="text-sm leading-relaxed text-ink-300">
              Sign-in is not configured. Set NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY, then
              reload.
            </p>
          </CardSection>
        </Card>
      ) : (
        <StudioOnboarding onboard={gate === "onboard"} />
      )}
    </div>
  );
}
