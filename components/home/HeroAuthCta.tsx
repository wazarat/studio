"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useUser } from "@clerk/nextjs";

import { Button } from "@/components/ui/Button";
import { AUTH_COPY } from "@/content/auth";
import { isAuthConfiguredClient } from "@/lib/auth-client";
import { STUDIO_PATH } from "@/lib/auth-paths";

/**
 * The hero's first button. Signed out it is "Sign up". Signed in the same
 * slot opens the studio, so the hero keeps its two-button layout. Client-side
 * Clerk state, like NavAuthButton, so the landing page stays static.
 */
function SignUpButton() {
  return (
    <Button asChild>
      <Link href={AUTH_COPY.signUpPath}>
        {AUTH_COPY.signUp}
        <ArrowRight aria-hidden="true" className="h-4 w-4" />
      </Link>
    </Button>
  );
}

function AuthAwareButton() {
  const { isLoaded, isSignedIn } = useUser();
  if (!isLoaded || !isSignedIn) return <SignUpButton />;
  return (
    <Button asChild>
      <Link href={STUDIO_PATH}>
        {AUTH_COPY.openStudio}
        <ArrowRight aria-hidden="true" className="h-4 w-4" />
      </Link>
    </Button>
  );
}

export function HeroAuthCta() {
  if (!isAuthConfiguredClient()) return <SignUpButton />;
  return <AuthAwareButton />;
}
