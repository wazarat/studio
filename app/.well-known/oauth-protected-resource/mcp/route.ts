import { corsHeaders, generateClerkProtectedResourceMetadata } from "@clerk/mcp-tools/server";
import { metadataCorsOptionsRequestHandler } from "@clerk/mcp-tools/next";

import { appOrigin } from "@/lib/mcp/auth";

export const dynamic = "force-dynamic";

/** RFC 9728 document for the account server: `resource` is the exact MCP URL. */
export function GET(req: Request) {
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  if (!publishableKey) return new Response("Sign-in is not configured", { status: 503 });
  const metadata = generateClerkProtectedResourceMetadata({ publishableKey, resourceUrl: `${appOrigin(req)}/mcp`, properties: { scopes_supported: ["profile", "email"] } });
  return new Response(JSON.stringify(metadata), { headers: { "Content-Type": "application/json", ...corsHeaders } });
}

export const OPTIONS = metadataCorsOptionsRequestHandler();
