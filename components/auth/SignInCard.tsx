"use client";

import Link from "next/link";
import { SignIn } from "@clerk/nextjs";

import { Button } from "@/components/ui/Button";
import { AUTH_COPY } from "@/content/auth";
import { STUDIO_PATH } from "@/lib/auth-paths";

/**
 * Clerk's sign-in card, hash-routed so no catch-all route is needed, the
 * same as canhav.com. Clerk reads ?redirect_url= from the page URL on its
 * own and it wins over the fallback. Google and the wallet buttons appear
 * once they are switched on in the Clerk dashboard.
 */
export function SignInCard() {
  return (
    <div className="max-w-md">
      <SignIn routing="hash" signUpUrl={AUTH_COPY.signUpPath} fallbackRedirectUrl={STUDIO_PATH} />
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <span className="text-sm text-ink-400">{AUTH_COPY.noAccount}</span>
        <Button asChild variant="outline" size="sm">
          <Link href={AUTH_COPY.signUpPath}>{AUTH_COPY.signUp}</Link>
        </Button>
      </div>
    </div>
  );
}
