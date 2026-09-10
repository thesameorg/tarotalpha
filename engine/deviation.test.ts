import { describe, expect, it } from "vitest";
import type { Candle } from "./atr";
import { deviation, praise } from "./deviation";

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

describe("praise", () => {
  const SPAN = 48;
  const gapOf = (normalised: number): number => normalised * Math.sqrt(SPAN);

  it("praises a reading that stayed inside a quarter of the readings measured", () => {
    expect(praise(gapOf(0.2), SPAN)).toBe("close");
  });

  it("says neither close nor far in the middle band", () => {
    expect(praise(gapOf(0.5), SPAN)).toBe("near");
  });

  it("calls a reading far when the gap passes the top quarter", () => {
    expect(praise(gapOf(1.2), SPAN)).toBe("far");
  });

  it("scales with the horizon: the same gap reads worse over fewer candles", () => {
    expect(praise(2, 48)).toBe("close");
    expect(praise(2, 4)).toBe("far");
  });

  it("refuses to judge before a single candle has been compared", () => {
    expect(() => praise(1, 0)).toThrow(RangeError);
  });
});
