import { env } from "cloudflare:workers";
import { afterEach, describe, expect, it, vi } from "vitest";
import { computeSteps } from "../engine/v1/index";
import { HOUR_MS, SNAPSHOT_LENGTH, lastClosedAnchor } from "../exchange/closed-candles";
import { callApi, post } from "./call-api";

const ANCHOR = lastClosedAnchor(Date.now()) - 24 * HOUR_MS;
const CREATE = { asset: "BTCUSDT", anchor_ts: ANCHOR, steps: 3, source: "binance", engine_version: "v1" };

interface Created {
  id: string;
  url: string;
}

interface ReadingBody {
  id: string;
  asset: string;
  anchor_ts: number;
  views: number;
  steps: unknown;
  candles_snapshot: [number, number, number, number, number][];
}

function binanceRows(count: number, endTs: number): unknown[] {
  return Array.from({ length: count }, (_, i) => {
    const t = endTs - (count - 1 - i) * HOUR_MS;
    const base = 100 + Math.sin(i / 5) * 5;
    return [t, String(base), String(base + 2), String(base - 2), String(base + 1), "10", t + HOUR_MS - 1];
  });
}

// The Worker code runs in the test isolate, so stubbing the global keeps every exchange call off the network.
function stubBinance(status: number, body: unknown): void {
  vi.stubGlobal(
    "fetch",
    vi.fn((input: string | URL) => {
      expect(new URL(input).hostname).toBe("api.binance.com");
      return Promise.resolve(new Response(typeof body === "string" ? body : JSON.stringify(body), { status }));
    }),
  );
}

// Storage is shared inside a test file, so events are compared against the row count seen before the call.
async function eventMark(): Promise<number> {
  const row = await env.DB.prepare("SELECT COALESCE(MAX(id), 0) AS n FROM events").first<{ n: number }>();
  return row?.n ?? 0;
}

async function eventTypesAfter(mark: number): Promise<string[]> {
  const { results } = await env.DB.prepare("SELECT type FROM events WHERE id > ?1 ORDER BY id")
    .bind(mark)
    .all<{ type: string }>();
  return results.map((row) => row.type);
}

async function share(overrides: Partial<typeof CREATE> = {}): Promise<Response> {
  return callApi("/api/readings", post({ ...CREATE, ...overrides }));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("POST /api/readings then GET /api/readings/:id", () => {
  it("stores the snapshot the Worker fetched and the steps the engine computed", async () => {
    stubBinance(200, binanceRows(SNAPSHOT_LENGTH, ANCHOR));
    const mark = await eventMark();
    const created = await share();
    expect(created.status).toBe(201);
    const { id, url } = await created.json<Created>();
    expect(url).toBe(`/r/${id}`);
    expect(await eventTypesAfter(mark)).toEqual(["shared"]);

    const read = await callApi(`/api/readings/${id}`);
    expect(read.status).toBe(200);
    const body = await read.json<ReadingBody>();
    expect(body).toMatchObject({ id, asset: "BTCUSDT", timeframe: "1H", anchor_ts: ANCHOR, source: "binance" });
    expect(body).toMatchObject({ engine_version: "v1", views: 0 });
    expect(body.candles_snapshot).toHaveLength(SNAPSHOT_LENGTH);
    expect(body.candles_snapshot[SNAPSHOT_LENGTH - 1]?.[0]).toBe(ANCHOR);
    const snapshot = body.candles_snapshot.map(([t, o, h, l, c]) => ({ t, o, h, l, c }));
    const expected = computeSteps({ asset: "BTCUSDT", anchorTs: ANCHOR, snapshot, steps: 3 }).map((step) => step.cards);
    expect(body.steps).toEqual(expected);
    expect(await eventTypesAfter(mark)).toEqual(["shared", "link_opened"]);
  });

  it("counts a view per read", async () => {
    stubBinance(200, binanceRows(SNAPSHOT_LENGTH, ANCHOR));
    const { id } = await (await share()).json<Created>();
    await callApi(`/api/readings/${id}`);
    const second = await (await callApi(`/api/readings/${id}`)).json<ReadingBody>();
    expect(second.views).toBe(1);
  });

  it("answers an unknown id with 404", async () => {
    const response = await callApi("/api/readings/zzzzzzzz");
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ error: "not_found" });
  });
});

describe("POST /api/readings validation", () => {
  it("puts a fourth step behind the paywall", async () => {
    const response = await share({ steps: 4 });
    expect(response.status).toBe(402);
    expect(await response.json()).toMatchObject({ error: "paywall", free_steps: 3 });
  });

  it("rejects an asset outside the symbol mask", async () => {
    const response = await share({ asset: "btc-usd" });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: "bad_request" });
  });

  it("rejects an anchor that is not on the hour", async () => {
    const response = await share({ anchor_ts: ANCHOR + 1 });
    expect(response.status).toBe(400);
  });

  it("refuses to store with an engine other than the server's", async () => {
    const response = await share({ engine_version: "v0" });
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ error: "engine_mismatch", engine_version: "v1" });
  });
});

describe("POST /api/readings when the exchange fails", () => {
  it("answers 422 when the window does not end at the anchor", async () => {
    stubBinance(200, binanceRows(SNAPSHOT_LENGTH - 1, ANCHOR));
    const response = await share();
    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({ error: "too_old" });
  });

  it("answers 502 and journals share_failed when the exchange is blocked", async () => {
    stubBinance(451, "blocked");
    const mark = await eventMark();
    const response = await share();
    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({ error: "unavailable" });
    expect(await eventTypesAfter(mark)).toEqual(["share_failed"]);
  });
});
