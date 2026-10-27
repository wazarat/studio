export const LOGIN_PATH = "/login";
export const SIGNUP_PATH = "/login?mode=signup";
export const STUDIO_PATH = "/studio";
export const WELCOME_PATH = "/welcome";

/**
 * A redirect target we are willing to follow after sign-in. Clerk's
 * middleware passes `redirect_url` as an absolute URL, so it is parsed
 * against the current origin and only a same-origin path (with its query)
 * comes back. Anything else, including protocol-relative `//host`, is dropped.
 */
export function safeRedirectPath(raw: string | null | undefined, origin: string): string | null {
  if (!raw) return null;
  if (raw.startsWith("//")) return null;
  try {
    const url = new URL(raw, origin);
    if (url.origin !== origin) return null;
    if (!url.pathname.startsWith("/")) return null;
    return `${url.pathname}${url.search}`;
  } catch {
    return null;
  }
}

/** Appends `redirect_url` to the login path when there is one worth keeping. */
export function loginPathFor(redirectPath: string | null): string {
  if (!redirectPath || redirectPath === STUDIO_PATH) return LOGIN_PATH;
  return `${LOGIN_PATH}?redirect_url=${encodeURIComponent(redirectPath)}`;
}
