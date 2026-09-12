import { describe, expect, it } from "vitest";
import { drawCards } from "./draw-cards";
import { GOLDEN as F } from "./golden/btcusdt";
import { computeSteps, DEFAULT_READER, forecastFromCards, READER_IDS } from "./index";
import { seedString } from "./seed";

const input = { asset: F.asset, anchorTs: F.anchorTs, snapshot: F.snapshot, reader: DEFAULT_READER };
const STEPS = [1, 2, 3];

describe("determinism", () => {
  it("gives byte-equal output for equal input", () => {
    const a = computeSteps({ ...input, steps: 3 });
    const b = computeSteps({ ...input, snapshot: F.snapshot.map((c) => ({ ...c })), steps: 3 });
    expect(b).toEqual(a);
    expect(JSON.stringify(b)).toBe(JSON.stringify(a));
    expect(a).toHaveLength(3);
    expect(a.flatMap((s) => s.candles)).toHaveLength(72);
  });

  it("replays stored cards into the same candles, effects and digest", () => {
    const drawn = computeSteps({ ...input, steps: 3 });
    const replayed = forecastFromCards({ ...input, cards: drawn.map((s) => s.cards) });
    expect(replayed).toEqual(drawn);
  });

  // The score rebuilds all five readers from one stored reading; a salt per reader, or one not stored, would end that.
  it("keeps the cards common to every reader and lets the nonce move only the candles", () => {
    const cards = computeSteps({ ...input, nonce: "k7", steps: 2 }).map((step) => step.cards);
    const salted = READER_IDS.map((reader) =>
      forecastFromCards({ ...input, reader, nonce: "k7", cards }).flatMap((step) => step.candles),
    );
    const other = READER_IDS.map((reader) =>
      forecastFromCards({ ...input, reader, nonce: "k9", cards }).flatMap((step) => step.candles),
    );
    expect(computeSteps({ ...input, nonce: "k7", steps: 2 }).map((step) => step.cards)).toEqual(cards);
    for (const [i, candles] of salted.entries()) {
      expect(candles).not.toEqual(other[i]);
      expect(salted.filter((series) => series !== candles).every((series) => series[0]?.c !== candles[0]?.c)).toBe(
        true,
      );
    }
  });

  it("chains candles: every step starts one hour after the previous close", () => {
    const [first, second] = computeSteps({ ...input, steps: 2 });
    expect(first?.candles[0]?.t).toBe(F.anchorTs + 3_600_000);
    expect(second?.candles[0]?.t).toBe(F.anchorTs + 25 * 3_600_000);
    expect(second?.candles[0]?.o).toBe(first?.candles[23]?.c);
  });
});

describe("the nonce in the seed", () => {
  it("appends the nonce as a fourth field only when it is set", () => {
    const parts = { asset: "BTCUSDT", anchorTs: 1789020000000, step: 2 };
    expect(seedString(parts)).toBe("BTCUSDT|1789020000000|2");
    expect(seedString({ ...parts, nonce: null })).toBe("BTCUSDT|1789020000000|2");
    expect(seedString({ ...parts, nonce: "k7" })).toBe("BTCUSDT|1789020000000|2|k7");
  });

  // The whole point of the nonce: one window, one instrument, two readings, and nothing in common but the market.
  it("draws other cards for another nonce and the same ones for the same nonce", () => {
    const seedsOf = (nonce?: string): string[] =>
      STEPS.map((step) => seedString({ asset: F.asset, anchorTs: F.anchorTs, step, nonce }));
    const mine = seedsOf("k7");
    expect(mine).not.toEqual(seedsOf("k9"));
    expect(mine).toEqual(seedsOf("k7"));
    expect(mine.map(drawCards)).not.toEqual(seedsOf("k9").map(drawCards));
    expect(computeSteps({ ...input, nonce: "k7", steps: 1 })).not.toEqual(computeSteps({ ...input, steps: 1 }));
    expect(computeSteps({ ...input, nonce: "k7", steps: 1 })).toEqual(
      computeSteps({ ...input, nonce: "k7", steps: 1 }),
    );
  });
});

describe("input validation", () => {
  it("refuses a snapshot shorter than the formulas can read", () => {
    expect(() => computeSteps({ ...input, snapshot: F.snapshot.slice(-24), steps: 1 })).toThrow(RangeError);
    expect(computeSteps({ ...input, snapshot: F.snapshot.slice(-25), steps: 1 })).toHaveLength(1);
  });

  it("refuses stored cards that are not three (id, 0|1) pairs", () => {
    const two = [
      [1, 0],
      [2, 0],
    ] as unknown as (typeof F.steps)[number]["cards"];
    const badFlag = [
      [1, 0],
      [2, 0],
      [3, 2],
    ] as unknown as (typeof F.steps)[number]["cards"];
    const badId = [
      [1, 0],
      [2, 0],
      [78, 0],
    ] as const;
    expect(() => forecastFromCards({ ...input, cards: [two] })).toThrow(RangeError);
    expect(() => forecastFromCards({ ...input, cards: [badFlag] })).toThrow(RangeError);
    expect(() => forecastFromCards({ ...input, cards: [badId] })).toThrow(RangeError);
  });
});
