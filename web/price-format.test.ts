import { describe, expect, it } from "vitest";
import { formatGap, formatPercent, roundStep } from "./price-format";

describe("formatPercent", () => {
  it("signs the number it prints, so a move too small to show is never negative zero", () => {
    expect(formatPercent(-0.001)).toBe("+0.00 %");
    expect(formatPercent(0)).toBe("+0.00 %");
  });

  it("keeps the sign of a move it can show", () => {
    expect(formatPercent(-1.5)).toBe("-1.50 %");
    expect(formatPercent(2.5)).toBe("+2.50 %");
  });
});

describe("formatGap", () => {
  it("prints the gap in the market's own unit, to two decimals", () => {
    expect(formatGap(1.234)).toBe("1.23 ATR");
    expect(formatGap(12)).toBe("12.00 ATR");
  });
});

describe("roundStep", () => {
  it("rounds a raw step up to one, two or five times a power of ten", () => {
    expect(roundStep(1)).toBe(1);
    expect(roundStep(1.4)).toBe(2);
    expect(roundStep(3)).toBe(5);
    expect(roundStep(7)).toBe(10);
  });

  it("holds its shape at any price, from a coin worth a fraction of a cent to one worth a house", () => {
    expect(roundStep(0.000012)).toBeCloseTo(0.00002, 10);
    expect(roundStep(1400)).toBe(2000);
  });

  it("answers a step for a range with no height, because a flat chart still asks", () => {
    expect(roundStep(0)).toBe(1);
    expect(roundStep(-5)).toBe(1);
  });
});
