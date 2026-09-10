import { expect, it } from "vitest";
import { callApi } from "./call-api";

const MINUTE_MS = 60_000;

it("answers the 61st request in a minute from one address with 429", { timeout: 20_000 }, async () => {
  // Miniflare aligns the window to the wall clock; a rollover in the middle of the test would reset the count.
  const untilRollover = MINUTE_MS - (Date.now() % MINUTE_MS);
  if (untilRollover < 5_000) await new Promise((resolve) => setTimeout(resolve, untilRollover));

  const headers = { "cf-connecting-ip": "203.0.113.7" };
  for (let i = 0; i < 60; i++) expect((await callApi("/api/health", { headers })).status).toBe(200);
  const limited = await callApi("/api/health", { headers });
  expect(limited.status).toBe(429);
  expect(limited.headers.get("retry-after")).toBe("60");
  expect(await limited.json()).toMatchObject({ error: "rate_limited" });
  expect((await callApi("/api/health", { headers: { "cf-connecting-ip": "203.0.113.8" } })).status).toBe(200);
});
