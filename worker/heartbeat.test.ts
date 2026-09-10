import { env } from "cloudflare:workers";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HOUR_MS } from "../exchange/closed-candles";
import { beat, BENCHMARK } from "./heartbeat";

const SLOT_MS = 4 * HOUR_MS;
const NOW = Date.now();

function stubExchanges(): void {
  vi.stubGlobal(
    "fetch",
    vi.fn((input: string | URL) => {
      const url = new URL(input);
      if (url.hostname !== "api.binance.com") return Promise.resolve(new Response("blocked", { status: 403 }));
      const limit = Number(url.searchParams.get("limit"));
      const start = url.searchParams.get("startTime");
      const first = start !== null ? Number(start) : Number(url.searchParams.get("endTime")) + 1 - limit * HOUR_MS;
      const rows = Array.from({ length: limit }, (_, i) => {
        const t = first + i * HOUR_MS;
        const base = 100 + Math.sin(t / (7 * HOUR_MS)) * 5;
        return [t, String(base), String(base + 2), String(base - 2), String(base + 1), "10", t + HOUR_MS - 1];
      });
      return Promise.resolve(new Response(JSON.stringify(rows)));
    }),
  );
}

async function track(): Promise<number[]> {
  const { results } = await env.DB.prepare(
    "SELECT anchor_ts FROM readings WHERE origin = 'beat' ORDER BY anchor_ts DESC",
  ).all<{ anchor_ts: number }>();
  return results.map((row) => row.anchor_ts);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("the score's own track", () => {
  it("draws the newest slot first, on the one instrument the score runs on", async () => {
    stubExchanges();
    const drawn = await beat(env, NOW);
    expect(drawn.length).toBeGreaterThan(0);
    for (const anchorTs of drawn) expect(anchorTs % SLOT_MS).toBe(0);
    expect(drawn).toEqual([...drawn].sort((a, b) => b - a));
    const row = await env.DB.prepare("SELECT asset, origin FROM readings WHERE anchor_ts = ?1")
      .bind(drawn[0])
      .first<{ asset: string; origin: string }>();
    expect(row).toMatchObject({ asset: BENCHMARK, origin: "beat" });
  });

  it("fills the track backwards and never draws a slot twice", async () => {
    stubExchanges();
    const before = await track();
    const drawn = await beat(env, NOW);
    const after = await track();
    expect(after).toHaveLength(before.length + drawn.length);
    expect(new Set(after).size).toBe(after.length);
    // Every new slot is older than what was already there: the track grows into the past, not around it.
    for (const anchorTs of drawn) expect(anchorTs).toBeLessThan(before[0] ?? Number.POSITIVE_INFINITY);
  });

  it("leaves the current slot alone once it has been drawn", async () => {
    stubExchanges();
    const newest = (await track())[0];
    await beat(env, NOW + HOUR_MS);
    expect((await track())[0]).toBe(newest);
  });
});
