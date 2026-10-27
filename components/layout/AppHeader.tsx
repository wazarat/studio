"use client";

import Link from "next/link";
import { ArrowUpRight, Check, ChevronDown } from "lucide-react";
import { useUser } from "@clerk/nextjs";

import { AccountMenu } from "@/components/layout/AccountMenu";
import { useAppShell } from "@/components/layout/AppShellContext";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { Logo } from "@/components/ui/Logo";
import { Menu, MenuItem } from "@/components/ui/Menu";
import { AUTH_COPY } from "@/content/auth";
import { NAV_LINKS } from "@/content/site";
import { STUDIO_COPY } from "@/content/studio";
import { STUDIO_PATH } from "@/lib/auth-paths";

/**
 * The signed-in header. Left: the mark linking to the studio, then the
 * breadcrumb (the account name, the plan as muted text, a switcher, and
 * the project name inside a project). Right: Meet and Docs opening in a new
 * tab, the theme toggle and the avatar. Teams come later; the switcher
 * lists the one account until then.
 */
export function AppHeader() {
  const { user } = useUser();
  const shell = useAppShell();
  const name = user
    ? [user.firstName, user.lastName].filter(Boolean).join(" ") || user.username || user.primaryEmailAddress?.emailAddress || ""
    : "";

  return (
    <header className="sticky top-0 z-40 border-b border-ink-700/40 bg-ink-950">
      <div className="container flex h-16 items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-2">
          <Logo markOnly href={STUDIO_PATH} />
          <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-sm">
            <span className="text-ink-600">/</span>
            <span className="truncate font-medium text-ink-50">{name}</span>
            <span className="hidden text-ink-400 sm:inline">{STUDIO_COPY.plan}</span>
            <Menu
              align="left"
              width="w-56"
              trigger={({ open, toggle }) => (
                <button
                  type="button"
                  aria-label={AUTH_COPY.switchAccount}
                  aria-expanded={open}
                  onClick={toggle}
                  className="rounded-md p-1 text-ink-400 transition-colors hover:bg-ink-800/60 hover:text-ink-50"
                >
                  <ChevronDown aria-hidden className="h-4 w-4" />
                </button>
              )}
            >
              <MenuItem>
                <Check aria-hidden className="h-3.5 w-3.5 text-ink-50" />
                <span className="truncate">{name}</span>
                <span className="ml-auto text-xs text-ink-400">{STUDIO_COPY.plan}</span>
              </MenuItem>
            </Menu>
            {shell?.project ? (
              <>
                <span className="text-ink-600">/</span>
                <span className="truncate text-ink-100">{shell.project}</span>
              </>
            ) : null}
          </nav>
        </div>
        <div className="flex shrink-0 items-center gap-3 sm:gap-5">
          <nav className="flex items-center gap-3 sm:gap-5" aria-label="Primary">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-0.5 whitespace-nowrap text-sm font-medium text-ink-300 transition-colors hover:text-ink-50"
              >
                {link.label}
                <ArrowUpRight aria-hidden className="h-3.5 w-3.5 text-ink-500" />
              </Link>
            ))}
          </nav>
          <ThemeToggle />
          <AccountMenu />
        </div>
      </div>
    </header>
  );
}
