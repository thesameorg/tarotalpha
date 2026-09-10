import { env } from "cloudflare:workers";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ENGINE_VERSION, READER_IDS } from "../engine/index";
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

function row(t: number): unknown[] {
  const base = 100 + Math.sin(t / (7 * HOUR_MS)) * 5;
  return [t, String(base), String(base + 2), String(base - 2), String(base + 1), "10", t + HOUR_MS - 1];
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
