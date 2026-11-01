import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";

import { Dashboard } from "@/components/studio/Dashboard";
import { StudioOnboarding } from "@/components/studio/StudioOnboarding";
import { Card, CardSection } from "@/components/ui/Card";
import { STUDIO_COPY } from "@/content/studio";
import { getInternalAdminGate, getOnboardingGate } from "@/lib/auth";
import { STUDIO_PATH, loginPathFor } from "@/lib/auth-paths";
import { loadDashboard } from "@/lib/strategies/dashboard";

export const metadata: Metadata = { title: STUDIO_COPY.kicker, robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * The signed-in home (step 4b): the dashboard. While strategies are
 * internal, the table, feed and workspace links show only to the
 * allowlist; everyone else sees the shell with markets and templates. An
 * account that has not finished signing up gets the steps as a pop-up.
 */
export default async function StudioPage() {
  const gate = await getOnboardingGate();
  if (gate === "signed-out") redirect(loginPathFor(STUDIO_PATH));

  if (gate === "unconfigured") {
    return (
      <div className="container py-10 md:py-14">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-ink-50 md:text-4xl">{STUDIO_COPY.kicker}</h1>
        <Card className="mt-10 max-w-md">
          <CardSection>
            <p className="text-sm leading-relaxed text-ink-300">
              Sign-in is not configured. Set NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY, then reload.
            </p>
          </CardSection>
        </Card>
      </div>
    );
  }

  const admin = (await getInternalAdminGate()) === "admin";
  const { userId } = await auth();
  const data = await loadDashboard(userId, admin);

  return (
    <>
      <Dashboard data={data} admin={admin} />
      <StudioOnboarding onboard={gate === "onboard"} />
    </>
  );
}
