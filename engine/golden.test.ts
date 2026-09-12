/**
 * Golden output of the engine for one synthetic BTCUSDT snapshot, plus what matches tarot-alpha.html: the hash,
 * the generator and the shuffle. A formula change regenerates engine/golden/btcusdt.ts on purpose; red here without
 * one means what every reading replays changed by accident.
 */
import { describe, expect, it } from "vitest";
import type { Candle } from "./atr";
import { atr, natr } from "./atr";
import { cardsToCandles } from "./card-to-candles";
import { drawCards } from "./draw-cards";
import type { GoldenStep } from "./golden/btcusdt";
import { GOLDEN as F } from "./golden/btcusdt";
import { makeRng, seedString } from "./seed";

function replay(steps: readonly GoldenStep[]): void {
  const previousForecast: Candle[] = [];
  for (const s of steps) {
    const candles = cardsToCandles({
      snapshot: F.snapshot,
      previousForecast,
      cards: s.cards,
      natr: F.natr,
      noiseSeed: s.noiseSeed,
    });
    expect(candles).toHaveLength(24);
    expect(candles).toEqual(s.candles);
    previousForecast.push(...candles);
  }
}

describe("parity with tarot-alpha.html", () => {
  it("hashes and generates the same numbers", () => {
    const r = makeRng(F.rng.seed);
    expect(F.rng.first.map(() => r())).toEqual(F.rng.first);
  });

  it("computes the same ATR(14) of the snapshot", () => {
    expect(atr(F.snapshot)).toBe(F.atr);
  });
});

describe("golden output of the engine", () => {
  it("builds the seed strings the fixture was generated from and draws its cards", () => {
    for (const s of F.steps) {
      const seed = seedString({ asset: F.asset, anchorTs: F.anchorTs, step: s.step });
      expect(seed).toBe(s.seed);
      expect(drawCards(seed)).toEqual(s.cards);
    }
  });

  it("scales by the fixture's NATR", () => {
    expect(natr(F.snapshot)).toBe(F.natr);
  });

  it("reproduces the 72 golden candles for the drawn cards", () => {
    replay(F.steps);
  });

  it("reproduces the golden candles for hand-picked cards that reach every card branch", () => {
    replay(F.chosen);
  });
});
