import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // `server-only` throws outside React Server Components; unit tests import server modules directly.
      "server-only": fileURLToPath(new URL("./src/test/server-only-stub.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "scripts/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: [
        "src/lib/money.ts",
        "src/lib/phone.ts",
        "src/lib/time.ts",
        "src/server/flags/rules.ts",
        "src/server/env.schema.ts",
        "src/server/auth/password.ts",
        "src/server/auth/totp.ts",
        "src/server/auth/jwt.ts",
        "src/server/crypto.ts",
        "src/lib/safe-next.ts",
        "scripts/lib/**",
      ],
      thresholds: { branches: 90 },
    },
  },
});
