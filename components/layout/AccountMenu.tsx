"use client";

import { useClerk, useUser } from "@clerk/nextjs";

import { Avatar, initialsOf } from "@/components/layout/Avatar";
import { Menu, MenuItem } from "@/components/ui/Menu";
import { AUTH_COPY } from "@/content/auth";

/**
 * The avatar at the top right once signed in: a menu with Account (Clerk's
 * profile, where the name, email, wallets and security live) and Sign out.
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
          className="rounded-full transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-500/60"
        >
          <Avatar src={user.hasImage ? user.imageUrl : null} initials={initialsOf(user)} />
        </button>
      )}
    >
      <MenuItem onSelect={() => clerk.openUserProfile()}>{AUTH_COPY.account}</MenuItem>
      <MenuItem onSelect={() => void clerk.signOut({ redirectUrl: "/" })}>{AUTH_COPY.signOut}</MenuItem>
    </Menu>
  );
}
