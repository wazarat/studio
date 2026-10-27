import Link from "next/link";

import { NavAuthButton } from "@/components/layout/NavAuthButton";
import { Logo } from "@/components/ui/Logo";
import { SoonBadge } from "@/components/ui/SoonBadge";
import { NAV_LINKS } from "@/content/site";

/**
 * The header: the logo, the Docs link, and either "Log in" or, once signed
 * in, a Studio link and the avatar menu. No theme toggle (dark only for now).
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
          <NavAuthButton />
        </div>
      </div>
    </header>
  );
}
