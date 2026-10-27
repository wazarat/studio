/**
 * Theme constants shared by server and client code (M73). lib/theme.ts is
 * a client module, and a server component importing a constant from it
 * gets a client reference, not the value, so the plain values live here.
 */

export type Theme = "dark" | "light";

/**
 * Bumped in M146 (was "canhav-theme") so everyone who toggled under the old
 * rules starts from the new defaults once; a stored choice still wins.
 */
export const THEME_STORAGE_KEY = "canhav-theme-v2";

/**
 * Clerk keeps a readable `__client_uat` cookie on the site domain, a unix
 * time when a session exists and "0" when none does. Clerk 6 and later also
 * set a suffixed copy (`__client_uat_<hash>`), so readers match the prefix.
 */
export const CLERK_SESSION_COOKIE = "__client_uat";

/** The default theme when nothing is stored: light signed in, dark otherwise (M146). */
export function defaultThemeFor(signedIn: boolean): Theme {
  return signedIn ? "light" : "dark";
}

/** Browser chrome colours per theme (meta theme-color and the viewport). */
export const THEME_COLOR: Record<Theme, string> = {
  dark: "#05060A",
  light: "#F5F5F7",
};
