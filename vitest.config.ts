import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

/**
 * Unit tests for the pure modules under lib/ (the risk checker, the
 * Chainlink comparison). No DOM, no Next runtime: the files under test must
 * not import "server-only" or Clerk.
 */
export default defineConfig({
  test: {
    include: ["lib/**/*.test.ts"],
    environment: "node",
    // The Ostium smoke test sends real testnet transactions and waits on them.
    testTimeout: 240_000,
    hookTimeout: 240_000,
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
      "server-only": fileURLToPath(new URL("./test/server-only.ts", import.meta.url)),
    },
  },
});
