import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { CreateProjectButton } from "@/components/studio/CreateProjectButton";
import { StudioOnboarding } from "@/components/studio/StudioOnboarding";
import { Card, CardSection } from "@/components/ui/Card";
import { STUDIO_COPY } from "@/content/studio";
import { getOnboardingGate } from "@/lib/auth";
import { STUDIO_PATH, loginPathFor } from "@/lib/auth-paths";

export const metadata: Metadata = { title: STUDIO_COPY.kicker, robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * The signed-in home: the heading with Create project top right and, until
 * projects come over from canhav.dev, the empty state. An account that has
 * not finished signing up gets the steps as a pop-up over this page.
 */
export default async function StudioPage() {
  const gate = await getOnboardingGate();
  if (gate === "signed-out") redirect(loginPathFor(STUDIO_PATH));

  return (
    <div className="container py-10 md:py-14">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <h1 className="font-display text-3xl font-semibold tracking-tight text-ink-50 md:text-4xl">
            {STUDIO_COPY.kicker}
          </h1>
          <p className="mt-3 text-base leading-relaxed text-ink-300">{STUDIO_COPY.subtitle}</p>
        </div>
        {gate === "unconfigured" ? null : <CreateProjectButton />}
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
        <>
          <Card className="mt-10">
            <CardSection className="flex flex-col items-start gap-4 py-12 md:items-center md:text-center">
              <div>
                <h2 className="font-display text-xl font-semibold tracking-tight text-ink-50">
                  {STUDIO_COPY.empty.title}
                </h2>
                <p className="mt-2 max-w-md text-sm leading-relaxed text-ink-300">{STUDIO_COPY.empty.lead}</p>
              </div>
              <CreateProjectButton />
            </CardSection>
          </Card>
          <StudioOnboarding onboard={gate === "onboard"} />
        </>
      )}
    </div>
  );
}
