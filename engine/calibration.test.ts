/**
 * Generated candles must look like real hourly candles of the same instrument: about one ATR of true range on
 * average, never narrower than 0.3 ATR, rarely a doji, never a gap, and the cards' promises (chop for the Hanged
 * Man, double range for the Moon, the whole crash inside the Tower's first candle) visible in the numbers.
 * Tables and formulas: docs/engine.md.
 */
import { describe, expect, it } from "vitest";
import type { Candle } from "./atr";
import { cardsToCandles } from "./card-to-candles";
import type { DrawnCard } from "./draw-cards";
import { GOLDEN as F } from "./golden/btcusdt";
import { computeSteps, MAX_STEPS } from "./index";

const NATR = F.natr;
const ASSETS = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "XRPUSDT", "DOGEUSDT"];
const ANCHORS = Array.from({ length: 50 }, (_, k) => F.anchorTs + k * 3_600_000);
const STEPS = MAX_STEPS;
const HANGED_MAN: DrawnCard = [12, 0];
const MOON: DrawnCard = [18, 0];
const TOWER: DrawnCard = [16, 0];
const SUN: DrawnCard = [19, 0];
// Ace of Cups upright is the minor closest to the defaults: drift 0, no pull, v = 1 + 0.8 / 14.
const DEFAULT_MINOR: DrawnCard = [36, 0];

function drawnSteps(): Candle[][] {
  const out: Candle[][] = [];
  for (const asset of ASSETS) {
    for (const anchorTs of ANCHORS) {
      const steps = computeSteps({ asset, anchorTs, snapshot: F.snapshot, reader: "atr", steps: STEPS });
      out.push(steps.flatMap((s) => s.candles));
    }
  }
  return out;
}

function blocksOf(card: DrawnCard): Candle[] {
  const out: Candle[] = [];
  for (const asset of ASSETS) {
    for (const anchorTs of ANCHORS) {
      const noiseSeed = `noise|${asset}|${String(anchorTs)}|1`;
      out.push(
        ...cardsToCandles({
          snapshot: F.snapshot,
          previousForecast: [],
          cards: [card, card, card],
          natr: NATR,
          noiseSeed,
        }),
      );
    }
  }
  return out;
}

function mean(xs: readonly number[]): number {
  return xs.reduce((s, x) => s + x, 0) / xs.length;
}

// Range as a fraction of the candle's own open, the unit the engine drew it in.
function meanRange(candles: readonly Candle[]): number {
  return mean(candles.map((c) => (c.h - c.l) / c.o));
}

describe(`calibration over ${String(ASSETS.length * ANCHORS.length)} seeds x ${String(STEPS)} steps`, () => {
  const readings = drawnSteps();
  const candles = readings.flat();

  it("has a mean true range of about one ATR of the previous close", () => {
    const last = F.snapshot.at(-1);
    expect(last).toBeDefined();
    let prev = last as Candle;
    const trueRanges = candles.map((c) => {
      const tr = Math.max(c.h - c.l, Math.abs(c.h - prev.c), Math.abs(c.l - prev.c)) / prev.c;
      prev = c;
      return tr;
    });
    const ratio = mean(trueRanges) / NATR;
    expect(ratio).toBeGreaterThanOrEqual(0.8);
    expect(ratio).toBeLessThanOrEqual(1.6);
  });

  it("never draws a candle narrower than 0.3 ATR", () => {
    for (const c of candles) expect(c.h - c.l).toBeGreaterThanOrEqual(0.3 * NATR * c.o - 1e-9);
  });

  it("draws a near-doji body in fewer than 20 % of candles", () => {
    const doji = candles.filter((c) => Math.abs(c.c - c.o) < 0.05 * NATR * c.o).length;
    expect(doji / candles.length).toBeLessThan(0.2);
  });

  it("opens every candle at the previous close, across steps too", () => {
    const anchorClose = F.snapshot[F.snapshot.length - 1]?.c;
    for (const reading of readings) {
      let prev = anchorClose;
      for (const c of reading) {
        expect(c.o).toBe(prev);
        prev = c.c;
      }
    }
  });

  it("keeps every price above zero even on a high-volatility snapshot", () => {
    const wild = F.snapshot.map((c) => ({ ...c, h: c.o * 1.08, l: c.o * 0.92 }));
    for (const asset of ASSETS) {
      const steps = computeSteps({ reader: "atr", asset, anchorTs: F.anchorTs, snapshot: wild, steps: STEPS });
      for (const c of steps.flatMap((s) => s.candles)) expect(c.l).toBeGreaterThan(0);
    }
  });
});

describe("card promises in the numbers", () => {
  const ma = mean(F.snapshot.slice(-24).map((c) => c.c));
  const defaults = blocksOf(DEFAULT_MINOR);
  const bodies = (cs: readonly Candle[]): number[] =>
    cs.filter((_, i) => i % 8 === 0).map((c) => (c.c - c.o) / (NATR * c.o));

  it("Hanged Man chops around the level: closer to ma than a default minor", () => {
    const deviation = (cs: readonly Candle[]) => mean(cs.map((c) => Math.abs(c.c - ma)));
    expect(deviation(blocksOf(HANGED_MAN))).toBeLessThan(deviation(defaults));
  });

  it("Moon spans at least 1.5x the range of a default minor", () => {
    expect(meanRange(blocksOf(MOON))).toBeGreaterThanOrEqual(1.5 * meanRange(defaults));
  });

  it("Tower drops the whole crash inside the body of its first candle", () => {
    for (const body of bodies(blocksOf(TOWER))) expect(body).toBeLessThan(-2.7);
  });

  it("Sun lifts the whole jump inside the body of its first candle", () => {
    for (const body of bodies(blocksOf(SUN))) expect(body).toBeGreaterThan(1.6);
  });
});
