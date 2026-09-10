import { describe, expect, it } from "vitest";
import type { Candle } from "./atr";
import { atr } from "./atr";
import { cardsToCandles } from "./card-to-candles";
import { cardById, DECK } from "./deck";
import { drawCards } from "./draw-cards";
import type { HtmlStep } from "./html-parity/btcusdt";
import { HTML_FIXTURE as F } from "./html-parity/btcusdt";
import { computeSteps, ENGINE_VERSION } from "./index";
import { interpret } from "./interpretation";
import { makeRng, seedString } from "./seed";

// The prototype seeds its noise without the engine version; the port takes the seed explicitly, so the test hands it
// the prototype's own string and expects the same doubles, not merely close ones.
function replay(steps: readonly HtmlStep[]): void {
  const previousForecast: Candle[] = [];
  for (const s of steps) {
    const candles = cardsToCandles({
      snapshot: F.snapshot,
      previousForecast,
      cards: s.cards,
      atr: F.atr,
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

  it("builds the same deck: ids, names, glyphs, labels", () => {
    expect(DECK.map(({ id, name, glyph, label }) => ({ id, name, glyph, label }))).toEqual(F.deck);
  });

  it("computes the same ATR(14) of the snapshot", () => {
    expect(atr(F.snapshot)).toBe(F.atr);
  });

  it("draws the same cards for steps 1-3 from the same seed strings", () => {
    for (const s of F.steps) {
      const seed = seedString({ asset: F.asset, anchorTs: F.anchorTs, step: s.step, engineVersion: ENGINE_VERSION });
      expect(seed).toBe(s.seed);
      expect(drawCards(seed)).toEqual(s.cards);
    }
  });

  it("generates the same 72 candles for the drawn cards", () => {
    replay(F.steps);
  });

  it("generates the same candles for hand-picked cards that reach every card branch", () => {
    replay(F.chosen);
  });

  it("says the same sentence for every card in both orientations", () => {
    expect(F.interpretations).toHaveLength(DECK.length * 2);
    for (const { id, reversed, text } of F.interpretations) {
      expect(interpret(cardById(id), reversed === 1)).toBe(text);
    }
  });

  it("differs from the prototype only in the noise seed, which now carries the engine version", () => {
    const [first] = computeSteps({ asset: F.asset, anchorTs: F.anchorTs, snapshot: F.snapshot, steps: 1 });
    const [drawn] = F.steps;
    expect(first?.cards).toEqual(drawn?.cards);
    expect(first?.candles).not.toEqual(drawn?.candles);
  });
});
