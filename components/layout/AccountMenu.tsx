"use client";

import { useClerk, useUser } from "@clerk/nextjs";

import { Menu, MenuItem } from "@/components/ui/Menu";
import { AUTH_COPY } from "@/content/auth";

/**
 * The avatar at the top right once signed in: a menu with Account (Clerk's
 * profile, where the name, email, wallets and security live) and Sign out.
 * canhav.dev's version listed Wallets and teams; Studio keeps it to these two.
 */
export function AccountMenu() {
  const clerk = useClerk();
  const { user } = useUser();
  if (!user) return null;
  const name = [user.firstName, user.lastName].filter(Boolean).join(" ") || user.username || AUTH_COPY.account;
  return (
    <Menu
      width="w-44"
      trigger={({ open, toggle }) => (
        <button
          type="button"
          aria-label={AUTH_COPY.account}
          aria-expanded={open}
          title={name}
          onClick={toggle}
          className="h-9 w-9 overflow-hidden rounded-full border border-ink-700/60 bg-ink-900 transition-colors hover:border-ink-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-500/60"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={user.imageUrl} alt="" className="h-full w-full object-cover" />
        </button>
      )}
    >
      <MenuItem onSelect={() => clerk.openUserProfile()}>{AUTH_COPY.account}</MenuItem>
      <MenuItem onSelect={() => void clerk.signOut({ redirectUrl: "/" })}>{AUTH_COPY.signOut}</MenuItem>
    </Menu>
  );
}
