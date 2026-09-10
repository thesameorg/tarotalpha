/**
 * Generated candles must look like real hourly candles of the same instrument: about one ATR of true range on
 * average, never narrower than 0.3 ATR, rarely a doji, and the cards' promises (chop for the Hanged Man, double
 * range for the Moon) visible in the numbers. Tables and formulas: docs/flows/card-to-candles.md.
 */
import { describe, expect, it } from "vitest";
import type { Candle } from "./atr";
import { cardsToCandles } from "./card-to-candles";
import type { DrawnCard } from "./draw-cards";
import { HTML_FIXTURE as F } from "./html-parity/btcusdt";
import { computeSteps, ENGINE_VERSION } from "./index";

const A = F.atr;
const ASSETS = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "XRPUSDT", "DOGEUSDT"];
const ANCHORS = Array.from({ length: 50 }, (_, k) => F.anchorTs + k * 3_600_000);
const STEPS = 3;
const HANGED_MAN: DrawnCard = [12, 0];
const MOON: DrawnCard = [18, 0];
// Ace of Cups upright is the minor closest to the defaults: drift 0, no pull, v = 1 + 0.8 / 14.
const DEFAULT_MINOR: DrawnCard = [36, 0];

function drawnCandles(): Candle[] {
  const out: Candle[] = [];
  for (const asset of ASSETS) {
    for (const anchorTs of ANCHORS) {
      const steps = computeSteps({ asset, anchorTs, snapshot: F.snapshot, steps: STEPS });
      out.push(...steps.flatMap((s) => s.candles));
    }
  }
  return out;
}

function blocksOf(card: DrawnCard): Candle[] {
  const out: Candle[] = [];
  for (const asset of ASSETS) {
    for (const anchorTs of ANCHORS) {
      const noiseSeed = `noise|${asset}|${String(anchorTs)}|1|${ENGINE_VERSION}`;
      out.push(
        ...cardsToCandles({ snapshot: F.snapshot, previousForecast: [], cards: [card, card, card], atr: A, noiseSeed }),
      );
    }
  }
  return out;
}

function mean(xs: readonly number[]): number {
  return xs.reduce((s, x) => s + x, 0) / xs.length;
}

function meanRange(candles: readonly Candle[]): number {
  return mean(candles.map((c) => c.h - c.l));
}

describe(`calibration over ${String(ASSETS.length * ANCHORS.length)} seeds x ${String(STEPS)} steps`, () => {
  const candles = drawnCandles();

  it("has a mean true range of about one ATR", () => {
    const last = F.snapshot.at(-1);
    expect(last).toBeDefined();
    let prev = last as Candle;
    const trueRanges = candles.map((c) => {
      const tr = Math.max(c.h - c.l, Math.abs(c.h - prev.c), Math.abs(c.l - prev.c));
      prev = c;
      return tr;
    });
    const ratio = mean(trueRanges) / A;
    expect(ratio).toBeGreaterThanOrEqual(0.8);
    expect(ratio).toBeLessThanOrEqual(1.6);
  });

  it("never draws a candle narrower than 0.3 ATR", () => {
    for (const c of candles) expect(c.h - c.l).toBeGreaterThanOrEqual(0.3 * A - 1e-9);
  });

  it("draws a near-doji body in fewer than 20 % of candles", () => {
    const doji = candles.filter((c) => Math.abs(c.c - c.o) < 0.05 * A).length;
    expect(doji / candles.length).toBeLessThan(0.2);
  });
});

describe("card promises in the numbers", () => {
  const ma = mean(F.snapshot.slice(-24).map((c) => c.c));
  const defaults = blocksOf(DEFAULT_MINOR);

  it("Hanged Man chops around the level: closer to ma than a default minor", () => {
    const deviation = (cs: readonly Candle[]) => mean(cs.map((c) => Math.abs(c.c - ma)));
    expect(deviation(blocksOf(HANGED_MAN))).toBeLessThan(deviation(defaults));
  });

  it("Moon spans at least 1.5x the range of a default minor", () => {
    expect(meanRange(blocksOf(MOON))).toBeGreaterThanOrEqual(1.5 * meanRange(defaults));
  });
});
