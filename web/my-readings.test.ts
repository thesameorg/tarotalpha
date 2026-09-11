import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HOUR_MS } from "../exchange/closed-candles";
import {
  cloudStore,
  findMyReading,
  hasUnchecked,
  hoursToRipe,
  initMyReadings,
  isRipe,
  markChecked,
  myReadings,
  rememberReading,
  ripensAt,
  type MyReading,
  type ReadingStore,
} from "./my-readings";

const ANCHOR = 1_757_548_800_000;
const BASE = { id: "bcdfghjk", asset: "BTCUSDT", anchor_ts: ANCHOR, steps: 1, reader: "atr" as const };

// A store in memory with the same contract as localStorage and CloudStorage, so the module under test is all logic.
function fakeStore(initial: string[] = []): ReadingStore & { values: Map<string, string> } {
  const values = new Map(initial.map((value, index) => [String(index), value]));
  return {
    values,
    read: () => Promise.resolve([...values.values()]),
    write: (id, value) => {
      values.set(id, value);
      return Promise.resolve();
    },
    remove: (id) => {
      values.delete(id);
      return Promise.resolve();
    },
  };
}

// `initMyReadings` picks a backend by the Telegram object; tests inject a fake through a CloudStorage look-alike.
function cloudOf(store: ReadingStore & { values: Map<string, string> }): Parameters<typeof cloudStore>[0] {
  return {
    getKeys: (done) => {
      done?.(
        null,
        [...store.values.keys()].map((id) => `reading_${id}`),
      );
    },
    getItems: (keys, done) => {
      done?.(null, Object.fromEntries(keys.map((key) => [key, store.values.get(key.slice("reading_".length)) ?? ""])));
    },
    setItem: (key, value, done) => {
      store.values.set(key.slice("reading_".length), value);
      done?.(null, true);
    },
    removeItem: (key, done) => {
      store.values.delete(key.slice("reading_".length));
      done?.(null, true);
    },
    getItem: () => undefined,
    removeItems: () => undefined,
  };
}

describe("my readings", () => {
  let store: ReturnType<typeof fakeStore>;

  beforeEach(() => {
    store = fakeStore();
    initMyReadings(cloudOf(store));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("remembers a reading, newest first, and keeps its first creation time", async () => {
    await rememberReading(BASE, 1000);
    await rememberReading({ ...BASE, id: "mnpqrstv", anchor_ts: ANCHOR + HOUR_MS }, 2000);
    await rememberReading({ ...BASE, steps: 2, reader: "garch" }, 3000);
    const list = await myReadings();
    expect(list.map((entry) => entry.id)).toEqual(["mnpqrstv", "bcdfghjk"]);
    expect(list[1]).toMatchObject({ steps: 2, reader: "garch", created_at: 1000, checked_at: null });
    expect(JSON.parse(store.values.get("bcdfghjk") ?? "")).toMatchObject({ steps: 2 });
  });

  it("finds the reading of a window this browser opened before, and only the same reader's", async () => {
    await rememberReading(BASE);
    expect((await findMyReading("BTCUSDT", ANCHOR, BASE.reader))?.id).toBe("bcdfghjk");
    expect(await findMyReading("BTCUSDT", ANCHOR + HOUR_MS, BASE.reader)).toBeUndefined();
    expect(await findMyReading("ETHUSDT", ANCHOR, BASE.reader)).toBeUndefined();
    expect(await findMyReading("BTCUSDT", ANCHOR, "garch")).toBeUndefined();
  });

  it("marks a reading checked once and writes it through", async () => {
    await rememberReading(BASE, 1000);
    await markChecked("bcdfghjk", 5000);
    await markChecked("bcdfghjk", 6000);
    expect((await myReadings())[0]?.checked_at).toBe(5000);
    expect(JSON.parse(store.values.get("bcdfghjk") ?? "")).toMatchObject({ checked_at: 5000 });
  });

  it("keeps two hundred readings and drops the oldest from the storage", async () => {
    for (let i = 0; i < 201; i++) await rememberReading({ ...BASE, id: `id${String(i)}` }, i);
    const list = await myReadings();
    expect(list).toHaveLength(200);
    expect(list[list.length - 1]?.id).toBe("id1");
    expect(store.values.has("id0")).toBe(false);
  });

  it("reads what the storage holds and skips what is not a reading", async () => {
    const stored: MyReading = { ...BASE, created_at: 7, checked_at: null };
    const odd = [
      JSON.stringify(stored),
      "garbage",
      JSON.stringify({ id: 1 }),
      JSON.stringify({ ...stored, id: "<b>x</b>" }),
      JSON.stringify({ ...stored, id: "mnpqrstv", asset: "btc usd" }),
    ];
    initMyReadings(cloudOf(fakeStore(odd)));
    expect(await myReadings()).toEqual([stored]);
  });

  it("reads a client that never answers as an empty storage, after three seconds", async () => {
    vi.useFakeTimers();
    initMyReadings({ ...cloudOf(store), getKeys: () => undefined });
    const list = myReadings();
    await vi.advanceTimersByTimeAsync(3000);
    expect(await list).toEqual([]);
  });

  it("starts empty when the storage refuses", async () => {
    initMyReadings({
      ...cloudOf(store),
      getKeys: (done) => {
        done?.("denied");
      },
    });
    expect(await myReadings()).toEqual([]);
    await rememberReading(BASE);
    expect((await myReadings()).map((entry) => entry.id)).toEqual(["bcdfghjk"]);
  });
});

describe("ripeness", () => {
  it("ripens when the last forecast candle has closed", () => {
    const one = { anchor_ts: ANCHOR, steps: 1 };
    expect(ripensAt(one)).toBe(ANCHOR + 25 * HOUR_MS);
    expect(ripensAt({ anchor_ts: ANCHOR, steps: 2 })).toBe(ANCHOR + 49 * HOUR_MS);
    expect(isRipe(one, ANCHOR + 25 * HOUR_MS - 1)).toBe(false);
    expect(isRipe(one, ANCHOR + 25 * HOUR_MS)).toBe(true);
  });

  it("counts whole hours to ripeness, never less than one", () => {
    const one = { anchor_ts: ANCHOR, steps: 1 };
    expect(hoursToRipe(one, ANCHOR)).toBe(25);
    expect(hoursToRipe(one, ANCHOR + 24 * HOUR_MS + 1)).toBe(1);
    expect(hoursToRipe(one, ANCHOR + 30 * HOUR_MS)).toBe(1);
  });

  it("says whether a ripe reading is still unchecked", () => {
    const ripe: MyReading = { ...BASE, created_at: 0, checked_at: null };
    const now = ANCHOR + 30 * HOUR_MS;
    expect(hasUnchecked([ripe], now)).toBe(true);
    expect(hasUnchecked([{ ...ripe, checked_at: now }], now)).toBe(false);
    expect(hasUnchecked([{ ...ripe, steps: 2 }], now)).toBe(false);
  });
});
