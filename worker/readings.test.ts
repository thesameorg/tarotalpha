import { env } from "cloudflare:workers";
import { afterEach, describe, expect, it, vi } from "vitest";
import { computeSteps, MAX_STEPS, type Candle, type StepCards } from "../engine/index";
import { HOUR_MS, SNAPSHOT_LENGTH, lastClosedAnchor } from "../exchange/closed-candles";
import { callApi, patch, post } from "./call-api";

const ANCHOR = lastClosedAnchor(Date.now()) - 24 * HOUR_MS;
const NONCE = "a1b2c3d4e5f6";
const CREATE = {
  asset: "BTCUSDT",
  anchor_ts: ANCHOR,
  steps: 2,
  source: "binance",
  reader: "atr" as string,
  seed_nonce: NONCE as string,
  cards: [] as unknown,
};

interface Created {
  id: string;
  url: string;
  steps: number;
}

interface ReadingBody {
  id: string;
  asset: string;
  anchor_ts: number;
  reader: string;
  seed_nonce: string | null;
  steps: unknown[];
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

// Cards come from the seed, not from the candles, so any snapshot long enough draws the ones the Worker will draw.
const FLAT: Candle[] = Array.from({ length: SNAPSHOT_LENGTH }, (_, i) => ({
  t: ANCHOR - (SNAPSHOT_LENGTH - 1 - i) * HOUR_MS,
  o: 100,
  h: 102,
  l: 98,
  c: 101,
}));

function drawnCards(body: typeof CREATE): StepCards[] {
  const steps = typeof body.steps === "number" && body.steps >= 1 && body.steps <= MAX_STEPS ? body.steps : 1;
  return computeSteps({
    asset: "BTCUSDT",
    anchorTs: ANCHOR,
    snapshot: FLAT,
    reader: "atr",
    nonce: body.seed_nonce,
    steps,
  }).map((step) => step.cards);
}

// The client sends the cards it drew; every valid request carries the ones this engine draws for its nonce.
async function share(overrides: Partial<typeof CREATE> = {}): Promise<Response> {
  const body = { ...CREATE, ...overrides };
  const cards = "cards" in overrides ? overrides.cards : drawnCards(body);
  return callApi("/api/readings", post({ ...body, cards }));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("POST /api/readings then GET /api/readings/:id", () => {
  it("stores the snapshot the Worker fetched and the steps the engine computed, and journals nothing", async () => {
    stubBinance(200, binanceRows(SNAPSHOT_LENGTH, ANCHOR));
    const mark = await eventMark();
    const created = await share();
    expect(created.status).toBe(201);
    const { id, url } = await created.json<Created>();
    expect(url).toBe(`/r/${id}`);
    expect(await eventTypesAfter(mark)).toEqual([]);

    const read = await callApi(`/api/readings/${id}`);
    expect(read.status).toBe(200);
    const body = await read.json<ReadingBody>();
    expect(body).toMatchObject({ id, asset: "BTCUSDT", timeframe: "1H", anchor_ts: ANCHOR, source: "binance" });
    expect(body).toMatchObject({ reader: "atr", seed_nonce: NONCE });
    expect(body.candles_snapshot).toHaveLength(SNAPSHOT_LENGTH);
    expect(body.candles_snapshot[SNAPSHOT_LENGTH - 1]?.[0]).toBe(ANCHOR);
    const snapshot = body.candles_snapshot.map(([t, o, h, l, c]) => ({ t, o, h, l, c }));
    const expected = computeSteps({
      asset: "BTCUSDT",
      anchorTs: ANCHOR,
      snapshot,
      reader: "atr",
      nonce: NONCE,
      steps: 2,
    }).map((step) => step.cards);
    expect(body.steps).toEqual(expected);
    expect(await eventTypesAfter(mark)).toEqual([]);
  });

  it("draws different cards for two readings of the same window: the nonce is the reading's own", async () => {
    stubBinance(200, binanceRows(SNAPSHOT_LENGTH, ANCHOR));
    const first = await (await share()).json<Created>();
    const second = await (await share({ seed_nonce: "f6e5d4c3b2a1" })).json<Created>();
    expect(second.id).not.toBe(first.id);
    const cardsOf = async (id: string): Promise<unknown> =>
      (await (await callApi(`/api/readings/${id}`)).json<ReadingBody>()).steps;
    expect(await cardsOf(second.id)).not.toEqual(await cardsOf(first.id));
  });

  it("answers an unknown id with 404", async () => {
    const response = await callApi("/api/readings/zzzzzzzz");
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ error: "not_found" });
  });
});

describe("POST /api/readings validation", () => {
  it("refuses a day past the horizon", async () => {
    const response = await share({ steps: MAX_STEPS + 1 });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: "bad_request" });
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

  it("refuses a reading without its own entropy: a nonce it cannot replay from is no nonce", async () => {
    for (const seed_nonce of [undefined, "", "short", "a1b2c3d4e5f6!"]) {
      const response = await share({ seed_nonce });
      expect(response.status, String(seed_nonce)).toBe(400);
      expect(await response.json()).toMatchObject({ error: "bad_request" });
    }
  });

  it("refuses cards it does not draw itself: a stale tab must not store a reading its author never saw", async () => {
    stubBinance(200, binanceRows(SNAPSHOT_LENGTH, ANCHOR));
    const mine = drawnCards(CREATE);
    const swapped = [mine[1], mine[0]] as unknown as StepCards[];
    const response = await share({ cards: swapped });
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ error: "cards_mismatch" });
  });

  it("refuses a body without the cards of every day", async () => {
    const response = await share({ cards: [[[0, 0]]] });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: "bad_request" });
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

describe("PATCH /api/readings/:id", () => {
  async function opened(steps: number): Promise<string> {
    stubBinance(200, binanceRows(SNAPSHOT_LENGTH, ANCHOR));
    const created = await share({ steps });
    expect(created.status).toBe(201);
    return (await created.json<Created>()).id;
  }

  it("adds the next day from the stored snapshot without asking the exchange again", async () => {
    const id = await opened(1);
    stubBinance(500, "down");
    const extended = await callApi(`/api/readings/${id}`, patch({ steps: 2, reader: "atr" }));
    expect(extended.status).toBe(200);
    expect(await extended.json()).toEqual({ id, url: `/r/${id}`, steps: 2 });

    const body = await (await callApi(`/api/readings/${id}`)).json<ReadingBody>();
    const snapshot = body.candles_snapshot.map(([t, o, h, l, c]) => ({ t, o, h, l, c }));
    const expected = computeSteps({
      asset: "BTCUSDT",
      anchorTs: ANCHOR,
      snapshot,
      reader: "atr",
      nonce: NONCE,
      steps: 2,
    }).map((step) => step.cards);
    expect(body.reader).toBe("atr");
    expect(body.steps).toEqual(expected);
  });

  it("never drops a day: a reopen asking for fewer keeps them all", async () => {
    const id = await opened(2);
    const extended = await callApi(`/api/readings/${id}`, patch({ steps: 1, reader: "atr" }));
    expect(await extended.json()).toMatchObject({ steps: 2 });
    const body = await (await callApi(`/api/readings/${id}`)).json<ReadingBody>();
    expect(body.steps).toHaveLength(2);
  });

  it("refuses a day from another reader: the forecast stays with the one who opened it", async () => {
    const id = await opened(1);
    const response = await callApi(`/api/readings/${id}`, patch({ steps: 2, reader: "garch" }));
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ error: "reader_locked" });
    const body = await (await callApi(`/api/readings/${id}`)).json<ReadingBody>();
    expect(body.reader).toBe("atr");
    expect(body.steps).toHaveLength(1);
  });

  it("never redraws a day already written: only the new one comes from this engine", async () => {
    const id = await opened(1);
    // As if the first day had been drawn by an engine whose shuffle differs from this one.
    const written = "[[[0,1],[1,1],[2,1]]]";
    await env.DB.prepare("UPDATE readings SET steps = ?2 WHERE id = ?1").bind(id, written).run();
    await callApi(`/api/readings/${id}`, patch({ steps: 2, reader: "atr" }));

    const body = await (await callApi(`/api/readings/${id}`)).json<ReadingBody>();
    const snapshot = body.candles_snapshot.map(([t, o, h, l, c]) => ({ t, o, h, l, c }));
    const fresh = computeSteps({ asset: "BTCUSDT", anchorTs: ANCHOR, snapshot, reader: "atr", nonce: NONCE, steps: 2 });
    expect(body.steps).toEqual([...(JSON.parse(written) as unknown[]), fresh[1]?.cards]);
  });

  it("grows past the second day up to the horizon, and no further", async () => {
    const id = await opened(2);
    const longest = await callApi(`/api/readings/${id}`, patch({ steps: MAX_STEPS, reader: "atr" }));
    expect(await longest.json()).toMatchObject({ steps: MAX_STEPS });
    const past = await callApi(`/api/readings/${id}`, patch({ steps: MAX_STEPS + 1, reader: "atr" }));
    expect(past.status).toBe(400);
  });

  it("answers an unknown id with 404", async () => {
    const response = await callApi("/api/readings/zzzzzzzz", patch({ steps: 2, reader: "atr" }));
    expect(response.status).toBe(404);
  });

  it("leaves the score's own readings alone", async () => {
    await env.DB.prepare(
      "INSERT INTO readings (id, asset, anchor_ts, source, reader, steps, candles_snapshot," +
        " created_at, origin) VALUES ('bbbbbbbb', 'BTCUSDT', ?1, 'binance', 'atr', '[]', '[]', ?2, 'beat')",
    )
      .bind(ANCHOR - 48 * HOUR_MS, Date.now())
      .run();
    const response = await callApi("/api/readings/bbbbbbbb", patch({ steps: 2, reader: "atr" }));
    expect(response.status).toBe(404);
  });
});
