import { env } from "cloudflare:workers";
import { afterEach, describe, expect, it, vi } from "vitest";
import { computeSteps } from "../engine/v1/index";
import { HOUR_MS, SNAPSHOT_LENGTH, lastClosedAnchor } from "../exchange/closed-candles";
import { callApi, post } from "./call-api";

const ANCHOR = lastClosedAnchor(Date.now()) - 24 * HOUR_MS;
const CREATE = { asset: "BTCUSDT", anchor_ts: ANCHOR, steps: 2, source: "binance", engine_version: "v1" };

interface Created {
  id: string;
  url: string;
}

interface ReadingBody {
  id: string;
  asset: string;
  anchor_ts: number;
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

function bybitRows(count: number, endTs: number): unknown[] {
  return binanceRows(count, endTs)
    .map((row) => (row as unknown[]).slice(0, 5).map(String))
    .reverse();
}

interface Reply {
  status: number;
  body: unknown;
}

const BLOCKED: Reply = { status: 403, body: "blocked" };

// The Worker code runs in the test isolate, so stubbing the global keeps every exchange call off the network.
function stubExchanges(binance: Reply, bybit: Reply = BLOCKED): void {
  vi.stubGlobal(
    "fetch",
    vi.fn((input: string | URL) => {
      const reply = new URL(input).hostname === "api.binance.com" ? binance : bybit;
      const text = typeof reply.body === "string" ? reply.body : JSON.stringify(reply.body);
      return Promise.resolve(new Response(text, { status: reply.status }));
    }),
  );
}

function stubBinance(status: number, body: unknown): void {
  stubExchanges({ status, body });
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
    expect(body).toMatchObject({ engine_version: "v1" });
    expect(body.candles_snapshot).toHaveLength(SNAPSHOT_LENGTH);
    expect(body.candles_snapshot[SNAPSHOT_LENGTH - 1]?.[0]).toBe(ANCHOR);
    const snapshot = body.candles_snapshot.map(([t, o, h, l, c]) => ({ t, o, h, l, c }));
    const expected = computeSteps({ asset: "BTCUSDT", anchorTs: ANCHOR, snapshot, steps: 2 }).map((step) => step.cards);
    expect(body.steps).toEqual(expected);
    expect(await eventTypesAfter(mark)).toEqual(["shared"]);
  });

  it("answers an unknown id with 404", async () => {
    const response = await callApi("/api/readings/zzzzzzzz");
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ error: "not_found" });
  });
});

describe("POST /api/readings validation", () => {
  it("puts the third step behind the paywall", async () => {
    const response = await share({ steps: 3 });
    expect(response.status).toBe(402);
    expect(await response.json()).toMatchObject({ error: "paywall", free_steps: 2 });
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

  it("snapshots from the next provider when the author's one blocks the edge, and records it", async () => {
    const bybit = { status: 200, body: { retCode: 0, result: { list: bybitRows(SNAPSHOT_LENGTH, ANCHOR) } } };
    stubExchanges(BLOCKED, bybit);
    const created = await share();
    expect(created.status).toBe(201);
    const { id } = await created.json<Created>();
    const body = await (await callApi(`/api/readings/${id}`)).json<ReadingBody>();
    expect(body).toMatchObject({ source: "bybit" });
    expect(body.candles_snapshot[SNAPSHOT_LENGTH - 1]?.[0]).toBe(ANCHOR);
  });

  it("answers 502 and journals share_failed when every exchange is blocked", async () => {
    stubBinance(451, "blocked");
    const mark = await eventMark();
    const response = await share();
    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({ error: "unavailable" });
    expect(await eventTypesAfter(mark)).toEqual(["share_failed"]);
  });
});
