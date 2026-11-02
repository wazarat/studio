/**
 * Where /studio may forward a signed-in visitor (step 6). Clerk's OAuth
 * authorize step sends people to /studio?redirect_url=<consent page on
 * the Account Portal>; without this hop the agent waits forever. Only a
 * same-origin path, the Account Portal or the app's own domain qualify.
 */
export function consentRedirectTarget(raw: string | null | undefined, origin: string, appUrl?: string | null): string | null {
  if (!raw || raw.startsWith("//")) return null;
  let url: URL;
  try {
    url = new URL(raw, origin);
  } catch {
    return null;
  }
  if (url.origin === origin) return `${url.pathname}${url.search}`;
  if (url.protocol !== "https:") return null;
  const host = url.hostname.toLowerCase();
  if (host.endsWith(".accounts.dev") || host.endsWith(".clerk.accounts.dev")) return url.toString();
  if (appUrl) {
    try {
      const app = new URL(appUrl).hostname.toLowerCase();
      if (host === app || host.endsWith(`.${app}`)) return url.toString();
    } catch {
      return null;
    }
  }
  return null;
}
