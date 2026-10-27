import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { Onboarding } from "@/components/onboarding/Onboarding";
import { AUTH_COPY } from "@/content/auth";
import { getOnboardingGate } from "@/lib/auth";
import { STUDIO_PATH, WELCOME_PATH, loginPathFor } from "@/lib/auth-paths";

export const metadata: Metadata = { title: AUTH_COPY.welcome.title, robots: { index: false } };
export const dynamic = "force-dynamic";

/** The sign-up steps after the email is verified. Done accounts go straight to the studio. */
export default async function WelcomePage() {
  const gate = await getOnboardingGate();
  if (gate === "signed-out" || gate === "unconfigured") redirect(loginPathFor(WELCOME_PATH));
  if (gate === "ready") redirect(STUDIO_PATH);
  const W = AUTH_COPY.welcome;
  return (
    <div className="container py-14 md:py-20">
      <div className="max-w-2xl">
        <h1 className="font-display text-4xl font-semibold tracking-tight text-ink-50 md:text-5xl">{W.title}</h1>
        <p className="mt-4 text-lg leading-relaxed text-ink-300">{W.lead}</p>
      </div>
      <div className="mt-10">
        <Onboarding />
      </div>
    </div>
  );
}
