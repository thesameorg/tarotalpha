import { describe, expect, it } from "vitest";
import type { Candle } from "./atr";
import type { StepCards } from "./draw-cards";
import { stepDigest } from "./step-digest";

const candle = (o: number, c: number, h: number, l: number): Candle => ({ t: 0, o, h, l, c });
const MINORS: StepCards = [
  [22, 0],
  [23, 0],
  [24, 0],
];

describe("step digest", () => {
  const candles = [candle(100, 102, 103, 99), candle(102, 101, 104, 100)];

  it("measures the net move against the first open, in percent and in ATR", () => {
    const d = stepDigest(MINORS, candles, 0.01);
    expect(d.netPct).toBeCloseTo(1);
    expect(d.netAtr).toBeCloseTo(1);
    expect(d.highPct).toBeCloseTo(4);
    expect(d.lowPct).toBeCloseTo(-1);
    expect(d.direction).toBe("up");
  });

  it("reads a move under half an ATR as flat", () => {
    expect(stepDigest(MINORS, candles, 0.05).direction).toBe("flat");
    expect(stepDigest(MINORS, [candle(100, 97, 101, 96)], 0.01).direction).toBe("down");
  });

  it("lets the strongest major rule the day, else the highest minor", () => {
    const rule = (cards: StepCards): number => stepDigest(cards, candles, 0.01).ruling;
    expect(
      rule([
        [22, 0],
        [16, 0],
        [19, 0],
      ]),
    ).toBe(1);
    expect(
      rule([
        [19, 0],
        [16, 1],
        [3, 0],
      ]),
    ).toBe(1);
    expect(
      rule([
        [3, 0],
        [5, 0],
        [22, 0],
      ]),
    ).toBe(0);
    expect(
      rule([
        [22, 0],
        [35, 0],
        [64, 0],
      ]),
    ).toBe(1);
  });

  it("flags a regime flip when the Wheel or Death is on the table", () => {
    expect(stepDigest(MINORS, candles, 0.01).reversal).toBe(false);
    expect(
      stepDigest(
        [
          [22, 0],
          [10, 0],
          [24, 0],
        ],
        candles,
        0.01,
      ).reversal,
    ).toBe(true);
    expect(
      stepDigest(
        [
          [13, 1],
          [23, 0],
          [24, 0],
        ],
        candles,
        0.01,
      ).reversal,
    ).toBe(true);
  });

  it("refuses an empty step", () => {
    expect(() => stepDigest(MINORS, [], 0.01)).toThrow(RangeError);
  });
});
