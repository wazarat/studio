import Link from "next/link";

import { SITE } from "@/content/site";
import { Logo } from "@/components/ui/Logo";

export function Footer() {
  return (
    <footer className="border-t border-ink-700/40 bg-ink-950/60">
      <div className="container flex flex-col items-start justify-between gap-6 py-10 md:flex-row md:items-center">
        <div className="space-y-2">
          <Logo />
          <p className="max-w-md text-sm text-ink-300">{SITE.footerBlurb}</p>
          <p className="text-sm">
            <Link
              href={SITE.docsUrl}
              className="font-medium text-ink-300 transition-colors hover:text-ink-50"
            >
              Docs
            </Link>
          </p>
        </div>
        <div className="text-xs text-ink-400">
          <p>
            © {new Date().getFullYear()} CanHav. {SITE.footerLegal}
          </p>
        </div>
      </div>
    </footer>
  );
}
