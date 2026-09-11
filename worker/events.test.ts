import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { callApi, post } from "./call-api";

async function rows(type: string): Promise<number> {
  const row = await env.DB.prepare("SELECT COUNT(*) AS n FROM events WHERE type = ?1")
    .bind(type)
    .first<{ n: number }>();
  return row?.n ?? 0;
}

describe("POST /api/events", () => {
  it("writes one row per client event", async () => {
    const before = await rows("step_opened");
    const posted = await callApi("/api/events", post({ type: "step_opened", asset: "BTCUSDT", step: 1 }));
    expect(posted.status).toBe(204);
    expect(await rows("step_opened")).toBe(before + 1);
  });

  it("rejects the event type only the server may write", async () => {
    const before = await rows("share_failed");
    const response = await callApi("/api/events", post({ type: "share_failed" }));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: "bad_request" });
    expect(await rows("share_failed")).toBe(before);
  });

  it("has no stats route any more", async () => {
    expect((await callApi("/api/stats/today")).status).toBe(404);
  });
});
