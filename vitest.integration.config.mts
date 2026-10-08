import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

process.loadEnvFile(".env");

// Integration tests run against the linked Supabase project (docs/decisions.md D-005) with real keys from .env.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": fileURLToPath(new URL("./src/test/server-only-stub.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    fileParallelism: false,
  },
});
