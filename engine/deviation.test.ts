import { describe, expect, it } from "vitest";
import type { Candle } from "./atr";
import { deviation } from "./deviation";

const HOUR = 3_600_000;
const candle = (hour: number, o: number, c: number): Candle => ({
  t: hour * HOUR,
  o,
  h: Math.max(o, c),
  l: Math.min(o, c),
  c,
});

describe("deviation", () => {
  it("is zero when the forecast closed where the market did", () => {
    const forecast = [candle(1, 10, 11), candle(2, 11, 12)];
    expect(deviation(forecast, forecast, 2)).toEqual({ compared: 2, deviation: 0 });
  });

  it("counts one unit when the gap is one unit wide", () => {
    expect(deviation([candle(1, 10, 12)], [candle(1, 10, 10)], 2)).toEqual({ compared: 1, deviation: 1 });
  });

  it("averages the gaps and ignores which side the forecast missed on", () => {
    const forecast = [candle(1, 10, 14), candle(2, 14, 8)];
    const real = [candle(1, 10, 10), candle(2, 10, 10)];
    expect(deviation(forecast, real, 2)).toEqual({ compared: 2, deviation: 1.5 });
  });

  it("pairs candles by open time and skips forecast candles without a real pair", () => {
    const forecast = [candle(1, 10, 12), candle(2, 12, 20)];
    expect(deviation(forecast, [candle(1, 10, 10)], 2)).toEqual({ compared: 1, deviation: 1 });
  });

  it("has no deviation before the future has happened", () => {
    expect(deviation([candle(1, 10, 11)], [], 2)).toEqual({ compared: 0, deviation: null });
  });

  it("refuses a unit that cannot scale a gap", () => {
    expect(() => deviation([candle(1, 10, 11)], [candle(1, 10, 10)], 0)).toThrow(RangeError);
  });
});
