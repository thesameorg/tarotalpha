import { describe, expect, it } from "vitest";
import { drawCards } from "./draw-cards";
import { HTML_FIXTURE as F } from "./html-parity/btcusdt";
import { computeSteps, ENGINE_VERSION, forecastFromCards } from "./index";
import { seedString } from "./seed";

const input = { asset: F.asset, anchorTs: F.anchorTs, snapshot: F.snapshot };
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

  it("replays stored cards into the same candles and sentences", () => {
    const drawn = computeSteps({ ...input, steps: 3 });
    const replayed = forecastFromCards({ ...input, cards: drawn.map((s) => s.cards) });
    expect(replayed).toEqual(drawn);
  });

  it("chains candles: every step starts one hour after the previous close", () => {
    const [first, second] = computeSteps({ ...input, steps: 2 });
    expect(first?.candles[0]?.t).toBe(F.anchorTs + 3_600_000);
    expect(second?.candles[0]?.t).toBe(F.anchorTs + 25 * 3_600_000);
    expect(second?.candles[0]?.o).toBe(first?.candles[23]?.c);
  });
});

describe("engine version in the seed", () => {
  it("changes the seed string and the drawn cards", () => {
    const v1 = STEPS.map((step) =>
      seedString({ asset: F.asset, anchorTs: F.anchorTs, step, engineVersion: ENGINE_VERSION }),
    );
    const v2 = STEPS.map((step) => seedString({ asset: F.asset, anchorTs: F.anchorTs, step, engineVersion: "v2" }));
    v1.forEach((seed, i) => {
      expect(seed).not.toBe(v2[i]);
    });
    expect(v2.map(drawCards)).not.toEqual(v1.map(drawCards));
  });

  it("appends the nonce as a fifth field only when it is set", () => {
    const parts = { asset: "BTCUSDT", anchorTs: 1789020000000, step: 2, engineVersion: "v1" };
    expect(seedString(parts)).toBe("BTCUSDT|1789020000000|2|v1");
    expect(seedString({ ...parts, nonce: null })).toBe("BTCUSDT|1789020000000|2|v1");
    expect(seedString({ ...parts, nonce: "k7" })).toBe("BTCUSDT|1789020000000|2|v1|k7");
    expect(computeSteps({ ...input, nonce: "k7", steps: 1 })).not.toEqual(computeSteps({ ...input, steps: 1 }));
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
