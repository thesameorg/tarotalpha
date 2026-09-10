// Test-only binding declared in vitest.config.ts and applied by worker/apply-migrations.ts; the deployed Worker never has it.
import type { D1Migration } from "cloudflare:test";

declare global {
  namespace Cloudflare {
    interface Env {
      TEST_MIGRATIONS: D1Migration[];
    }
  }
}

export {};
