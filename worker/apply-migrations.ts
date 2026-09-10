/** Vitest setup: the D1 schema from `migrations/` is applied before every Worker test file. */
import { applyD1Migrations } from "cloudflare:test";
import { env } from "cloudflare:workers";

await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
