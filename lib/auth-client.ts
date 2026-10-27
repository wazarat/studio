/**
 * Client-side mirror of lib/auth.ts isAuthConfigured(). Only the publishable
 * key is visible in the browser bundle; the server check also requires the
 * secret key.
 */
export function isAuthConfiguredClient(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);
}
