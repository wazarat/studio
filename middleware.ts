import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { type NextRequest, NextResponse } from "next/server";

/**
 * Clerk session detection, scoped to the routes that read it: the login
 * page (so a signed-in visitor is sent on), the studio and the sign-up
 * steps. The landing page stays static and reads session state in the
 * browser. clerkMiddleware throws at request time without keys, so an
 * unconfigured deploy degrades to pass-through: the pages then show their
 * "not configured" placeholders instead of crashing.
 */
const configured = Boolean(
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY,
);

const isProtected = createRouteMatcher(["/studio(.*)", "/welcome(.*)"]);

export default configured
  ? clerkMiddleware(async (auth, req) => {
      if (isProtected(req)) await auth.protect();
    })
  : (_req: NextRequest) => NextResponse.next();

export const config = {
  matcher: ["/login", "/studio/:path*", "/welcome/:path*"],
};
