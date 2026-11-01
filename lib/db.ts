import "server-only";

import { neon } from "@neondatabase/serverless";

/**
 * Neon over HTTP, the same client canhav.dev uses (Studio step 4). Studio's
 * tables live in the `studio` schema and every query names it. Without
 * DATABASE_URL this returns null and callers answer "Storage not configured"
 * instead of crashing, so the engine and the pages still load.
 */
export function getDb() {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  return neon(url);
}

export type Db = NonNullable<ReturnType<typeof getDb>>;
