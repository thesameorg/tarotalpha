import { afterEach, describe, expect, it, vi } from "vitest";
import { HOUR_MS, SNAPSHOT_LENGTH, fetchAfter, fetchSnapshot, lastClosedAnchor } from "./closed-candles";
import { ExchangeError } from "./provider";

const ANCHOR = 1_789_020_000_000;

function binanceRows(count: number, endTs: number): unknown[] {
  return Array.from({ length: count }, (_, i) => {
    const t = endTs - (count - 1 - i) * HOUR_MS;
    return [t, "1.0", "2.0", "0.5", "1.5", "10", t + HOUR_MS - 1];
  });
}

function bybitRows(count: number, endTs: number): unknown[] {
  return binanceRows(count, endTs)
    .map((row) => (row as unknown[]).slice(0, 5).map(String))
    .reverse();
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function stubFetch(handler: (url: URL) => Response | Promise<Response>): ReturnType<typeof vi.fn> {
  const mock = vi.fn((input: string | URL) => Promise.resolve(handler(new URL(input))));
  vi.stubGlobal("fetch", mock);
  return mock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("lastClosedAnchor", () => {
  it("is the open time of the candle before the current hour", () => {
    const now = ANCHOR + 2 * HOUR_MS + 34 * 60_000;
    expect(lastClosedAnchor(now)).toBe(ANCHOR + HOUR_MS);
  });
});

describe("fetchSnapshot", () => {
  it("parses Binance rows into ascending numeric candles", async () => {
    const fetchMock = stubFetch((url) => {
      expect(url.hostname).toBe("api.binance.com");
      expect(url.searchParams.get("endTime")).toBe(String(ANCHOR + HOUR_MS - 1));
      return jsonResponse(binanceRows(SNAPSHOT_LENGTH, ANCHOR));
    });
    const snapshot = await fetchSnapshot("BTCUSDT", ANCHOR, ["binance"]);
    expect(snapshot.source).toBe("binance");
    expect(snapshot.candles).toHaveLength(SNAPSHOT_LENGTH);
    expect(snapshot.candles[SNAPSHOT_LENGTH - 1]).toEqual({ t: ANCHOR, o: 1, h: 2, l: 0.5, c: 1.5 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("asks Bybit first and reverses its newest-first list", async () => {
    const fetchMock = stubFetch((url) => {
      expect(url.hostname).toBe("api.bybit.com");
      return jsonResponse({ retCode: 0, retMsg: "OK", result: { list: bybitRows(SNAPSHOT_LENGTH, ANCHOR) } });
    });
    const snapshot = await fetchSnapshot("BTCUSDT", ANCHOR);
    expect(snapshot.source).toBe("bybit");
    expect(snapshot.candles[0]?.t).toBe(ANCHOR - (SNAPSHOT_LENGTH - 1) * HOUR_MS);
    expect(snapshot.candles[SNAPSHOT_LENGTH - 1]?.t).toBe(ANCHOR);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("falls back to Binance when Bybit is blocked", async () => {
    stubFetch((url) =>
      url.hostname === "api.bybit.com"
        ? new Response("blocked", { status: 403 })
        : jsonResponse(binanceRows(SNAPSHOT_LENGTH, ANCHOR)),
    );
    const snapshot = await fetchSnapshot("BTCUSDT", ANCHOR);
    expect(snapshot.source).toBe("binance");
  });

  it("falls back to Binance when Bybit answers something that is not JSON", async () => {
    stubFetch((url) =>
      url.hostname === "api.bybit.com"
        ? new Response("<html>checking your browser</html>", { status: 200 })
        : jsonResponse(binanceRows(SNAPSHOT_LENGTH, ANCHOR)),
    );
    const snapshot = await fetchSnapshot("BTCUSDT", ANCHOR);
    expect(snapshot.source).toBe("binance");
  });

  it("gives every exchange call a deadline: a provider that hangs must not keep the next one waiting", async () => {
    const fetchMock = stubFetch(() => jsonResponse(binanceRows(SNAPSHOT_LENGTH, ANCHOR)));
    await fetchSnapshot("BTCUSDT", ANCHOR, ["binance"]);
    await fetchSnapshot("BTCUSDT", ANCHOR, ["bybit"]).catch(() => undefined);
    for (const call of fetchMock.mock.calls) expect((call[1] as RequestInit).signal).toBeInstanceOf(AbortSignal);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("uses only the sources it is given", async () => {
    const fetchMock = stubFetch(() =>
      jsonResponse({ retCode: 0, retMsg: "OK", result: { list: bybitRows(SNAPSHOT_LENGTH, ANCHOR) } }),
    );
    await fetchSnapshot("BTCUSDT", ANCHOR, ["bybit"]);
    const called = fetchMock.mock.calls.map((call) => new URL(call[0] as string | URL).hostname);
    expect(called).toEqual(["api.bybit.com"]);
  });

  it("reports an unknown asset when every provider rejects the symbol", async () => {
    stubFetch((url) =>
      url.hostname === "api.binance.com"
        ? jsonResponse({ code: -1121, msg: "Invalid symbol." }, 400)
        : jsonResponse({ retCode: 10001, retMsg: "params error: symbol invalid" }),
    );
    await expect(fetchSnapshot("NOPE", ANCHOR)).rejects.toMatchObject({ kind: "unknown_asset" });
  });

  it("refuses a window that does not end at the anchor", async () => {
    stubFetch((url) =>
      url.hostname === "api.binance.com"
        ? jsonResponse(binanceRows(SNAPSHOT_LENGTH - 1, ANCHOR))
        : jsonResponse({ retCode: 0, retMsg: "OK", result: { list: bybitRows(SNAPSHOT_LENGTH, ANCHOR - HOUR_MS) } }),
    );
    const failure = await fetchSnapshot("BTCUSDT", ANCHOR).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(ExchangeError);
    expect((failure as ExchangeError).kind).toBe("too_old");
  });
});

describe("fetchAfter", () => {
  it("returns only closed candles after the anchor", async () => {
    stubFetch((url) => {
      expect(url.searchParams.get("startTime")).toBe(String(ANCHOR + HOUR_MS));
      return jsonResponse(binanceRows(5, ANCHOR + 5 * HOUR_MS));
    });
    const now = ANCHOR + 3 * HOUR_MS + 10;
    const real = await fetchAfter("BTCUSDT", ANCHOR, 24, "binance", now);
    expect(real.map((candle) => candle.t)).toEqual([ANCHOR + HOUR_MS, ANCHOR + 2 * HOUR_MS]);
  });
});
