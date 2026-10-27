import { clerkMiddleware } from "@clerk/nextjs/server";
import { type NextRequest, NextResponse } from "next/server";

/**
 * Clerk session detection, scoped to the routes that read it: the login
 * page (so a signed-in visitor is sent on) and the studio. The pages themselves decide what a signed-out visitor sees (they
 * redirect to /login), so the middleware only makes auth() available. The
 * landing page stays static and reads session state in the browser.
 * clerkMiddleware throws at request time without keys, so an unconfigured
 * deploy degrades to pass-through and the pages show their placeholders.
 */
const configured = Boolean(
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY,
);

export default configured ? clerkMiddleware() : (_req: NextRequest) => NextResponse.next();

export const config = {
  matcher: ["/login", "/studio/:path*"],
};
