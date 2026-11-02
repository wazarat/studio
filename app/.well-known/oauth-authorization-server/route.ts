import { authServerMetadataHandlerClerk, metadataCorsOptionsRequestHandler } from "@clerk/mcp-tools/next";

export const dynamic = "force-dynamic";

/** RFC 8414 document, proxied from Clerk, for clients that predate protected-resource discovery. */
export const GET = authServerMetadataHandlerClerk();
export const OPTIONS = metadataCorsOptionsRequestHandler();
