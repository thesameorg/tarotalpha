import { describe, expect, it } from "vitest";
import { callApi, post } from "./call-api";

async function stepsToday(): Promise<number> {
  const body = await (await callApi("/api/stats/today")).json<{ steps_today: number }>();
  return body.steps_today;
}

describe("POST /api/events and GET /api/stats/today", () => {
  it("counts step_opened since 00:00 UTC", async () => {
    const before = await stepsToday();
    const posted = await callApi("/api/events", post({ type: "step_opened", asset: "BTCUSDT", step: 1 }));
    expect(posted.status).toBe(204);
    expect(await stepsToday()).toBe(before + 1);
  });

  it("rejects event types only the server may write", async () => {
    const before = await stepsToday();
    const response = await callApi("/api/events", post({ type: "shared" }));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: "bad_request" });
    expect(await stepsToday()).toBe(before);
  });
});
