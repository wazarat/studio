"use client";

import Link from "next/link";
import { SignUp } from "@clerk/nextjs";

import { Button } from "@/components/ui/Button";
import { AUTH_COPY } from "@/content/auth";
import { STUDIO_PATH } from "@/lib/auth-paths";

/**
 * Clerk's sign-up card, hash-routed like SignInCard. Email with a code, or
 * Google, or a wallet; a wallet sign-up is asked for its email by Clerk
 * because the instance requires one. A finished sign-up lands on /studio,
 * where the name, avatar and how-you-build steps open as a pop-up.
 */
export function SignUpCard() {
  return (
    <div className="max-w-md">
      <SignUp routing="hash" signInUrl={AUTH_COPY.signInPath} fallbackRedirectUrl={STUDIO_PATH} />
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <span className="text-sm text-ink-400">{AUTH_COPY.haveAccount}</span>
        <Button asChild variant="outline" size="sm">
          <Link href={AUTH_COPY.signInPath}>{AUTH_COPY.logIn}</Link>
        </Button>
      </div>
    </div>
  );
}
