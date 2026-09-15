import { describe, expect, it } from "vitest";
import { callApi, type Init } from "./call-api";

const VISIT = "v=v0a1b2c3&s=s0d4e5f6&p=tg&tp=ios&d=mobile&os=iOS&l=ru&th=dark&src=t.me&h=14";

/** A dataset that keeps what it was told, in place of the binding: nothing reads points back out of the real one. */
function journal(): { dataset: AnalyticsEngineDataset; points: AnalyticsEngineDataPoint[] } {
  const points: AnalyticsEngineDataPoint[] = [];
  return {
    points,
    dataset: {
      writeDataPoint(point?: AnalyticsEngineDataPoint) {
        points.push(point ?? {});
      },
    },
  };
}

function omen(body: unknown, visit: string | null = VISIT): Init {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (visit !== null) headers["X-Visit"] = visit;
  return { method: "POST", headers, body: JSON.stringify(body) };
}

describe("POST /api/omen", () => {
  it("writes one point per client event: the visit the browser named, then what happened", async () => {
    const funnel = journal();
    const posted = await callApi(
      "/api/omen",
      omen({ type: "step_opened", asset: "BTCUSDT", reading_id: "bcdfghjk", step: 3 }),
      { ANALYTICS: funnel.dataset },
    );

    expect(posted.status).toBe(204);
    expect(funnel.points).toHaveLength(1);
    const [point] = funnel.points;
    // The visitor is the sampling key, so a day that trips sampling drops whole visitors and shares stay honest.
    expect(point?.indexes).toEqual(["v0a1b2c3"]);
    expect(point?.blobs?.slice(0, 9)).toEqual([
      "step_opened",
      "v0a1b2c3",
      "s0d4e5f6",
      "tg",
      "ios",
      "mobile",
      "iOS",
      "ru",
      "dark",
    ]);
    expect(point?.blobs?.slice(15)).toEqual(["t.me", "BTCUSDT", "bcdfghjk"]);
    expect(point?.doubles?.[0]).toBe(3);
    expect(point?.doubles?.[1]).toBe(14);
  });

  it("counts a browser that names no visit, without pretending it is somebody", async () => {
    const funnel = journal();
    const posted = await callApi("/api/omen", omen({ type: "chart_loaded", asset: "BTCUSDT" }, null), {
      ANALYTICS: funnel.dataset,
    });

    expect(posted.status).toBe(204);
    const [point] = funnel.points;
    expect(point?.indexes).toEqual(["unknown"]);
    expect(point?.blobs?.[2]).toBe("");
    // No step and no round trip measured: a gap reads as -1, never as a zero an average could swallow.
    expect(point?.doubles?.[0]).toBe(-1);
  });

  it("keeps a claim from bloating a point: control characters out, length capped", async () => {
    const funnel = journal();
    const long = "x".repeat(200);
    await callApi("/api/omen", omen({ type: "chart_loaded" }, `v=ab&l=${long}`), { ANALYTICS: funnel.dataset });

    const [point] = funnel.points;
    expect(point?.blobs?.[1]).toBe("ab");
    expect(point?.blobs?.[7]).toBe("x".repeat(64));
  });

  it("rejects the event type only the server may write", async () => {
    const funnel = journal();
    const response = await callApi("/api/omen", omen({ type: "share_failed" }), { ANALYTICS: funnel.dataset });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: "bad_request" });
    expect(funnel.points).toHaveLength(0);
  });

  it("has no stats route any more", async () => {
    expect((await callApi("/api/stats/today")).status).toBe(404);
  });
});
