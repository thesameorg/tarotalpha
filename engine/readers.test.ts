/**
 * What every reader owes whatever its mechanic: the same cards from one seed, candles that chain without a gap,
 * nothing narrower than 0.3 ATR, no price at or below zero, byte-equal repeats, and no built-in direction. Plus
 * the point of having readers at all: one seed, three readers, three different forecasts.
 */
import { describe, expect, it } from "vitest";
import { natr, type Candle } from "./atr";
import { GOLDEN as F } from "./golden/btcusdt";
import { computeSteps, MAX_STEPS, READER_IDS, type ReaderId } from "./index";
import { makeRng } from "./seed";

const ANCHOR = F.anchorTs;
const INPUT = { asset: F.asset, anchorTs: ANCHOR, snapshot: F.snapshot, steps: MAX_STEPS };
const MIN_RANGE = 0.3;

function candlesOf(reader: ReaderId, input = INPUT): Candle[] {
  return computeSteps({ ...input, reader }).flatMap((step) => step.candles);
}

/** A random walk with no drift: a reader that leans one way cannot hide behind the snapshot's own trend. */
function walk(seed: string, count: number, anchorTs: number): Candle[] {
  const r = makeRng(seed);
  const out: Candle[] = [];
  let price = 30000;
  for (let i = 0; i < count; i++) {
    const o = price;
    const c = o + (r() - 0.5) * o * 0.01;
    out.push({ t: anchorTs - (count - 1 - i) * 3_600_000, o, h: Math.max(o, c) * 1.002, l: Math.min(o, c) * 0.998, c });
    price = c;
  }
  return out;
}

describe.each(READER_IDS)("reader %s", (reader: ReaderId) => {
  it("draws 24 candles per step and chains them without a gap", () => {
    const steps = computeSteps({ ...INPUT, reader });
    expect(steps).toHaveLength(MAX_STEPS);
    const candles = steps.flatMap((step) => step.candles);
    expect(candles).toHaveLength(MAX_STEPS * 24);
    expect(candles[0]?.t).toBe(ANCHOR + 3_600_000);
    let previous = F.snapshot.at(-1);
    for (const candle of candles) {
      expect(candle.o).toBe(previous?.c);
      expect(candle.t).toBe((previous?.t ?? 0) + 3_600_000);
      previous = candle;
    }
  });

  it("keeps every candle a real body: high above low, wicks around it, nothing at zero", () => {
    const unit = natr(F.snapshot);
    for (const candle of candlesOf(reader)) {
      expect(candle.l).toBeGreaterThan(0);
      expect(candle.h).toBeGreaterThanOrEqual(Math.max(candle.o, candle.c));
      expect(candle.l).toBeLessThanOrEqual(Math.min(candle.o, candle.c));
      expect(candle.h - candle.l).toBeGreaterThanOrEqual(MIN_RANGE * unit * candle.o * 0.999);
    }
  });

  it("repeats byte for byte from the same seed", () => {
    const again = computeSteps({ ...INPUT, snapshot: F.snapshot.map((c) => ({ ...c })), reader });
    expect(JSON.stringify(again)).toBe(JSON.stringify(computeSteps({ ...INPUT, reader })));
  });

  it("leans neither way over every day of forty readings on drift-free snapshots", () => {
    let up = 0;
    let total = 0;
    for (let i = 0; i < 40; i++) {
      // The instrument has to change too: cards come from asset, anchor and step, so one asset would draw one
      // hand forty times over and the count would say nothing about the reader.
      const snapshot = walk(`walk-${String(i)}`, 168, ANCHOR);
      const asset = `WALK${String(i)}USDT`;
      for (const step of computeSteps({ asset, anchorTs: ANCHOR, snapshot, reader, steps: MAX_STEPS })) {
        const first = step.candles[0];
        const last = step.candles.at(-1);
        if (first === undefined || last === undefined) continue;
        total++;
        if (last.c > first.o) up++;
      }
    }
    expect(total).toBe(40 * MAX_STEPS);
    expect(up / total).toBeGreaterThan(0.3);
    expect(up / total).toBeLessThan(0.7);
  });
});

describe("readers against each other", () => {
  it("draw the same cards: the reader seeds the noise, never the shuffle", () => {
    const cards = READER_IDS.map((reader) => computeSteps({ ...INPUT, reader }).map((step) => step.cards));
    for (const drawn of cards) expect(drawn).toEqual(cards[0]);
  });

  it("draw different candles from one seed, which is the whole point of choosing one", () => {
    const seen = READER_IDS.map((reader) => JSON.stringify(candlesOf(reader)));
    expect(new Set(seen).size).toBe(READER_IDS.length);
  });
});
