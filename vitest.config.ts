import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";
import path from "node:path";
import { defineConfig } from "vitest/config";

// Engine and exchange tests run in plain Node; Worker tests run inside workerd with the bindings from wrangler.jsonc.
// The D1 schema reaches the Worker tests through a test-only binding that worker/apply-migrations.ts applies.
export default defineConfig({
  test: {
    projects: [
      { test: { name: "node", include: ["engine/**/*.test.ts", "exchange/**/*.test.ts"] } },
      {
        plugins: [
          cloudflareTest(async () => ({
            wrangler: { configPath: "./wrangler.jsonc" },
            miniflare: {
              bindings: { TEST_MIGRATIONS: await readD1Migrations(path.join(import.meta.dirname, "migrations")) },
            },
          })),
        ],
        test: { name: "worker", include: ["worker/**/*.test.ts"], setupFiles: ["./worker/apply-migrations.ts"] },
      },
    ],
  },
});
