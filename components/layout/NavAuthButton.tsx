"use client";

import Link from "next/link";
import { useUser } from "@clerk/nextjs";

import { AccountMenu } from "@/components/layout/AccountMenu";
import { Button } from "@/components/ui/Button";
import { AUTH_COPY } from "@/content/auth";
import { isAuthConfiguredClient } from "@/lib/auth-client";
import { STUDIO_PATH } from "@/lib/auth-paths";

function LogInButton() {
  return (
    <Button asChild size="sm">
      <Link href={AUTH_COPY.signInPath}>{AUTH_COPY.logIn}</Link>
    </Button>
  );
}

/** Signed in: a Studio link and the avatar menu. Signed out, or while Clerk loads: the Log in button. */
function AuthAware() {
  const { isLoaded, isSignedIn } = useUser();
  if (!isLoaded || !isSignedIn) return <LogInButton />;
  return (
    <>
      <Link
        href={STUDIO_PATH}
        className="whitespace-nowrap text-sm font-medium text-ink-300 transition-colors hover:text-ink-50"
      >
        {AUTH_COPY.studio}
      </Link>
      <AccountMenu />
    </>
  );
}

export function NavAuthButton() {
  // Config is fixed per build, so the hook component mounts consistently.
  if (!isAuthConfiguredClient()) return <LogInButton />;
  return <AuthAware />;
}
