import { env } from "cloudflare:workers";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  atr,
  deviation,
  ENGINE_VERSION,
  forecastFromCards,
  READER_IDS,
  type Candle,
  type StepCards,
} from "../engine/index";
import { HOUR_MS, lastClosedAnchor } from "../exchange/closed-candles";
import { callApi, post } from "./call-api";
import { sweepMatured } from "./scoring";

const HORIZON = 48;
const NOW = Date.now();
const MATURED = lastClosedAnchor(NOW) - HORIZON * HOUR_MS;
const GREEN = lastClosedAnchor(NOW) - 24 * HOUR_MS;

interface Verdict {
  scores: string | null;
  scored_at: number | null;
  scored_version: string | null;
  attempts: number;
}

/** The candle the exchange stub serves for the hour opening at `t`. */
function candleAt(t: number): Candle {
  const base = 100 + Math.sin(t / (7 * HOUR_MS)) * 5;
  return { t, o: base, h: base + 2, l: base - 2, c: base + 1 };
}

function row(t: number): unknown[] {
  const { o, h, l, c } = candleAt(t);
  return [t, String(o), String(h), String(l), String(c), "10", t + HOUR_MS - 1];
}

// The provider asks for a window, not for a fixture: every kline call is answered from its own query string.
function stubExchanges(binanceStatus = 200): void {
  vi.stubGlobal(
    "fetch",
    vi.fn((input: string | URL) => {
      const url = new URL(input);
      if (url.hostname !== "api.binance.com") return Promise.resolve(new Response("blocked", { status: 403 }));
      if (binanceStatus !== 200) return Promise.resolve(new Response("no", { status: binanceStatus }));
      const limit = Number(url.searchParams.get("limit"));
      const start = url.searchParams.get("startTime");
      const first = start !== null ? Number(start) : Number(url.searchParams.get("endTime")) + 1 - limit * HOUR_MS;
      const rows = Array.from({ length: limit }, (_, i) => row(first + i * HOUR_MS));
      return Promise.resolve(new Response(JSON.stringify(rows)));
    }),
  );
}

async function shareAt(anchorTs: number): Promise<string> {
  const response = await callApi(
    "/api/readings",
    post({
      asset: "BTCUSDT",
      anchor_ts: anchorTs,
      steps: 2,
      source: "binance",
      reader: "atr",
      engine_version: ENGINE_VERSION,
    }),
  );
  expect(response.status).toBe(201);
  return (await response.json<{ id: string }>()).id;
}

// The score's own track is drawn by the cron; here the shortest way onto it is to share a reading and relabel it.
async function beatAt(anchorTs: number): Promise<string> {
  const id = await shareAt(anchorTs);
  await env.DB.prepare("UPDATE readings SET origin = 'beat' WHERE id = ?1").bind(id).run();
  return id;
}

async function verdictOf(id: string): Promise<Verdict> {
  const row = await env.DB.prepare("SELECT scores, scored_at, scored_version, attempts FROM readings WHERE id = ?1")
    .bind(id)
    .first<Verdict>();
  if (row === null) throw new Error(`no reading ${id}`);
  return row;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("the sweep", () => {
  it("scores every reader at the table from one set of real candles", async () => {
    stubExchanges();
    const id = await beatAt(MATURED);
    expect(await sweepMatured(env, NOW)).toMatchObject({ scored: 1 });

    const verdict = await verdictOf(id);
    expect(verdict.scored_at).toBeGreaterThan(0);
    expect(verdict).toMatchObject({ scored_version: ENGINE_VERSION, attempts: 0 });
    const drifts = JSON.parse(verdict.scores ?? "{}") as Record<string, number>;
    expect(Object.keys(drifts).sort()).toEqual([...READER_IDS].sort());
    for (const drift of Object.values(drifts)) expect(drift).toBeGreaterThan(0);
    // Five mechanics on one set of cards cannot land on the same distance from the market.
    expect(new Set(Object.values(drifts)).size).toBe(READER_IDS.length);
  });

  // The verdict and the badge on the link must speak one unit: the snapshot's ATR in price, as the browser divides.
  it("writes every drift in ATR of the snapshot, the same number the link computes", async () => {
    stubExchanges();
    const id = await beatAt(MATURED - 8 * HOUR_MS);
    await sweepMatured(env, NOW);
    const stored = await env.DB.prepare("SELECT anchor_ts, steps, candles_snapshot, scores FROM readings WHERE id = ?1")
      .bind(id)
      .first<{ anchor_ts: number; steps: string; candles_snapshot: string; scores: string }>();
    if (stored === null) throw new Error(`no reading ${id}`);
    const rows = JSON.parse(stored.candles_snapshot) as [number, number, number, number, number][];
    const snapshot = rows.map(([t, o, h, l, c]) => ({ t, o, h, l, c }));
    const cards = JSON.parse(stored.steps) as StepCards[];
    const real = Array.from({ length: HORIZON }, (_, i) => candleAt(stored.anchor_ts + (i + 1) * HOUR_MS));
    const drifts = JSON.parse(stored.scores) as Record<string, number>;
    for (const reader of READER_IDS) {
      const forecast = forecastFromCards({ asset: "BTCUSDT", anchorTs: stored.anchor_ts, snapshot, reader, cards });
      const expected = deviation(
        forecast.flatMap((step) => step.candles),
        real,
        atr(snapshot),
      ).deviation;
      expect(drifts[reader]).toBeCloseTo(expected ?? NaN, 9);
    }
  });

  it("leaves a verdict alone however often it runs", async () => {
    stubExchanges();
    const id = await beatAt(MATURED - HOUR_MS);
    await sweepMatured(env, NOW);
    const first = await verdictOf(id);
    expect(await sweepMatured(env, NOW + HOUR_MS)).toMatchObject({ scored: 0 });
    expect(await verdictOf(id)).toEqual(first);
  });

  it("waits for the horizon to close", async () => {
    stubExchanges();
    const id = await beatAt(GREEN);
    await sweepMatured(env, NOW);
    expect(await verdictOf(id)).toMatchObject({ scores: null, scored_at: null, attempts: 0 });
  });

  it("never scores a reading somebody shared: the rating is not theirs to move", async () => {
    stubExchanges();
    const id = await shareAt(MATURED - 5 * HOUR_MS);
    await sweepMatured(env, NOW);
    expect(await verdictOf(id)).toMatchObject({ scores: null, scored_at: null, attempts: 0 });
  });

  it("parks a reading whose candles the exchange keeps refusing", async () => {
    stubExchanges();
    const id = await beatAt(MATURED - 2 * HOUR_MS);
    vi.unstubAllGlobals();
    stubExchanges(500);
    for (let attempt = 0; attempt < 4; attempt++) await sweepMatured(env, NOW);
    expect(await verdictOf(id)).toMatchObject({ scored_at: null, attempts: 3 });
  });

  // The last forecast candle opens a whole horizon after the anchor and closes an hour later; the cron ticks every
  // ten minutes through that hour, and none of those ticks may spend an attempt on a candle still being drawn.
  it("spends no attempt before the last forecast candle has closed", async () => {
    stubExchanges();
    const anchorTs = MATURED - 3 * HOUR_MS;
    const id = await beatAt(anchorTs);
    const closes = anchorTs + (HORIZON + 1) * HOUR_MS;
    for (let tick = 6; tick > 0; tick--) await sweepMatured(env, closes - tick * 10 * 60_000);
    expect(await verdictOf(id)).toMatchObject({ scored_at: null, attempts: 0 });
    await sweepMatured(env, closes);
    expect((await verdictOf(id)).scored_at).toBe(closes);
  });

  it("parks a row it cannot replay instead of stalling the readings behind it", async () => {
    stubExchanges();
    const broken = MATURED - 7 * HOUR_MS;
    await env.DB.prepare(
      "INSERT INTO readings (id, asset, anchor_ts, source, engine_version, reader, steps, candles_snapshot," +
        " created_at, origin) VALUES ('cccccccc', 'BTCUSDT', ?1, 'binance', ?2, 'atr', '[[[0,0],[1,0],[2,0]]]'," +
        " '{', ?3, 'beat')",
    )
      .bind(broken, ENGINE_VERSION, Date.now())
      .run();
    const id = await beatAt(broken + HOUR_MS);
    expect(await sweepMatured(env, NOW)).toEqual({ scored: 1, parked: 1 });
    expect(await verdictOf("cccccccc")).toMatchObject({ scored_at: null, attempts: 1 });
    expect((await verdictOf(id)).scored_at).toBe(NOW);
  });
});

describe("GET /api/readers", () => {
  it("stands the whole table up, scored or not", async () => {
    stubExchanges();
    await beatAt(MATURED - 4 * HOUR_MS);
    await sweepMatured(env, NOW);
    const response = await callApi("/api/readers");
    expect(response.status).toBe(200);
    const body = await response.json<{ verdicts: number; readers: { reader: string; stars: number }[] }>();
    expect(body.readers.map((entry) => entry.reader)).toEqual([...READER_IDS]);
    expect(body.verdicts).toBeGreaterThan(0);
    for (const entry of body.readers) expect(entry.stars).toBeGreaterThanOrEqual(1);
  });
});
