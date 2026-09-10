import { exports } from "cloudflare:workers";
import { expect, it } from "vitest";

it("answers /api/health with the engine version from wrangler vars", async () => {
  const response = await exports.default.fetch("https://tarotalpha.test/api/health");
  expect(await response.json()).toEqual({ ok: true, engine: "v1" });
});

it("answers unknown /api/* routes with a JSON 404", async () => {
  const response = await exports.default.fetch("https://tarotalpha.test/api/nothing");
  expect(response.status).toBe(404);
  expect(await response.json()).toMatchObject({ error: "not_found" });
});
