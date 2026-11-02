import { corsHeaders, generateClerkProtectedResourceMetadata } from "@clerk/mcp-tools/server";
import { metadataCorsOptionsRequestHandler } from "@clerk/mcp-tools/next";

import { appOrigin } from "@/lib/mcp/auth";

export const dynamic = "force-dynamic";

/** RFC 9728 document for one strategy's server. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  if (!publishableKey) return new Response("Sign-in is not configured", { status: 503 });
  const metadata = generateClerkProtectedResourceMetadata({ publishableKey, resourceUrl: `${appOrigin(req)}/mcp/s/${id.toLowerCase()}`, properties: { scopes_supported: ["profile", "email"] } });
  return new Response(JSON.stringify(metadata), { headers: { "Content-Type": "application/json", ...corsHeaders } });
}

export const OPTIONS = metadataCorsOptionsRequestHandler();
