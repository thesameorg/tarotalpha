import { describe, expect, it } from "vitest";
import { accuracy } from "./accuracy";
import type { Candle } from "./atr";

const HOUR = 3_600_000;
const candle = (hour: number, o: number, c: number): Candle => ({
  t: hour * HOUR,
  o,
  h: Math.max(o, c),
  l: Math.min(o, c),
  c,
});

describe("accuracy", () => {
  it("pairs candles by open time and counts matching directions", () => {
    const forecast = [candle(1, 10, 11), candle(2, 11, 9), candle(3, 9, 12)];
    const real = [candle(2, 11, 12), candle(1, 10, 13), candle(4, 12, 8)];
    expect(accuracy(forecast, real)).toEqual({ compared: 2, hits: 1, accuracy: 0.5 });
  });

  it("does not count forecast candles without a real pair", () => {
    const forecast = [candle(1, 10, 11), candle(2, 11, 12)];
    expect(accuracy(forecast, [candle(2, 11, 12)])).toEqual({ compared: 1, hits: 1, accuracy: 1 });
  });

  it("returns null accuracy before the future has happened", () => {
    expect(accuracy([candle(1, 10, 11)], [])).toEqual({ compared: 0, hits: 0, accuracy: null });
    expect(accuracy([], [candle(1, 10, 11)])).toEqual({ compared: 0, hits: 0, accuracy: null });
  });

  it("reads an unchanged close as up on both sides", () => {
    expect(accuracy([candle(1, 10, 10)], [candle(1, 10, 10.5)])).toEqual({ compared: 1, hits: 1, accuracy: 1 });
    expect(accuracy([candle(1, 10, 10)], [candle(1, 10, 9.5)])).toEqual({ compared: 1, hits: 0, accuracy: 0 });
  });
});
