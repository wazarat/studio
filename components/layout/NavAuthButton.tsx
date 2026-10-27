"use client";

import Link from "next/link";
import { useUser } from "@clerk/nextjs";

import { Button } from "@/components/ui/Button";
import { AUTH_COPY } from "@/content/auth";
import { isAuthConfiguredClient } from "@/lib/auth-client";
import { STUDIO_PATH } from "@/lib/auth-paths";

function LogInButton() {
  return (
    <Button asChild size="sm">
      <Link href={AUTH_COPY.signInPath}>{AUTH_COPY.signIn}</Link>
    </Button>
  );
}

/** The marketing header's one filled button: Sign in, or Open Studio once signed in. */
function AuthAware() {
  const { isLoaded, isSignedIn } = useUser();
  if (!isLoaded || !isSignedIn) return <LogInButton />;
  return (
    <Button asChild size="sm">
      <Link href={STUDIO_PATH}>{AUTH_COPY.openStudio}</Link>
    </Button>
  );
}

export function NavAuthButton() {
  // Config is fixed per build, so the hook component mounts consistently.
  if (!isAuthConfiguredClient()) return <LogInButton />;
  return <AuthAware />;
}
