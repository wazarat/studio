import Link from "next/link";

import { Button } from "@/components/ui/Button";
import { Logo } from "@/components/ui/Logo";
import { SoonBadge } from "@/components/ui/SoonBadge";
import { AUTH_COPY } from "@/content/auth";
import { NAV_LINKS } from "@/content/site";

/**
 * The signed-out header from canhav.dev, without the theme toggle, the
 * studio breadcrumb and the Clerk-aware account button: the logo, the
 * Docs link and one "Log in" button to the login page.
 */
export function Nav() {
  return (
    <header className="sticky top-0 z-40 border-b border-ink-700/40 bg-ink-950/80 backdrop-blur-xl">
      <div className="container flex h-16 items-center justify-between">
        <div className="flex min-w-0 items-center gap-2">
          <Logo compact />
        </div>
        <div className="flex shrink-0 items-center gap-3 sm:gap-6">
          <nav className="flex items-center gap-3 sm:gap-6" aria-label="Primary">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="inline-flex items-center gap-1.5 whitespace-nowrap text-sm font-medium text-ink-300 transition-colors hover:text-ink-50"
              >
                {link.label}
                {link.soon && <SoonBadge label="Soon" />}
              </Link>
            ))}
          </nav>
          <Button asChild size="sm">
            <Link href={AUTH_COPY.signInPath}>{AUTH_COPY.logIn}</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
