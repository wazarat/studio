import type { Metadata } from "next";

import { Card, CardSection } from "@/components/ui/Card";
import { AUTH_COPY } from "@/content/auth";
import { STUDIO_COPY } from "@/content/studio";

export const metadata: Metadata = { title: AUTH_COPY.logIn };

/**
 * The login page. On canhav.dev this was the signed-out view of /studio: the
 * heading, the subtitle and Clerk's sign-in card. The card slot holds a
 * placeholder until Clerk is connected in a later step.
 */
export default function LoginPage() {
  return (
    <div className="container py-14 md:py-20">
      <div className="max-w-2xl">
        <h1 className="font-display text-4xl font-semibold tracking-tight text-ink-50 md:text-5xl">
          {STUDIO_COPY.kicker}
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-ink-300">{STUDIO_COPY.subtitle}</p>
      </div>
      <Card className="mt-10 max-w-md">
        <CardSection>
          <h2 className="font-display text-xl font-semibold tracking-tight text-ink-50">
            {AUTH_COPY.logInOrSignUp}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-300">
            Sign-in is coming in a later step. This is where you will log in or create your
            account.
          </p>
        </CardSection>
      </Card>
    </div>
  );
}
