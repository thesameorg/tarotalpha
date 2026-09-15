import { describe, expect, it } from "vitest";
import { formatGap, formatPercent } from "./price-format";

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
