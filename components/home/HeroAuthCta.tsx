import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { AUTH_COPY } from "@/content/auth";

/**
 * The hero's first button: "Sign up", to the login page. On canhav.dev this
 * slot became "Open Studio" once signed in; that comes back with Clerk.
 */
export function HeroAuthCta() {
  return (
    <Button asChild>
      <Link href={AUTH_COPY.signUpPath}>
        {AUTH_COPY.signUp}
        <ArrowRight aria-hidden="true" className="h-4 w-4" />
      </Link>
    </Button>
  );
}
