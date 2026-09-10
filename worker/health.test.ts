import { ENGINE_VERSION } from "../engine/index";
import { exports } from "cloudflare:workers";
import { expect, it } from "vitest";

it("answers /api/health with the engine version label", async () => {
  const response = await exports.default.fetch("https://tarotalpha.test/api/health");
  expect(await response.json()).toEqual({ ok: true, engine: ENGINE_VERSION });
});

it("answers unknown /api/* routes with a JSON 404", async () => {
  const response = await exports.default.fetch("https://tarotalpha.test/api/nothing");
  expect(response.status).toBe(404);
  expect(await response.json()).toMatchObject({ error: "not_found" });
});
