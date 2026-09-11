/**
 * A reader that pulls the price back to the 20-candle mean instead of letting it drift away. The card sets how
 * hard the pull is, how wide the noise around it and where the mean itself moves; the Tower and the Sun overshoot
 * for one candle and the pull drags the price back after them. Character: swings in a corridor, almost no trend.
 * The mechanic and why it is in the set: docs/engine.md.
 */
import { natr, type Candle } from "./atr";
import { CANDLES_PER_CARD, cardEffect } from "./card-effect";
import { cardById } from "./deck";
import type { ReaderInput } from "./readers";
import { makeRng } from "./seed";

const MEAN_OVER = 20;
const HOUR_MS = 3_600_000;
const MIN_RANGE = 0.3;

export function meanReversion(input: ReaderInput): Candle[] {
  const r = makeRng(input.noiseSeed);
  const all = [...input.snapshot, ...input.previousForecast];
  let last = all.at(-1);
  if (last === undefined || all.length < MEAN_OVER) {
    throw new RangeError(`meanReversion needs ${String(MEAN_OVER)} candles of history, got ${String(all.length)}`);
  }
  const unit = natr(input.snapshot);
  // The mean is the target, not a moving average: it only moves where a card pushes it, so the price has something
  // to come back to. A mean that followed the price would make this reader drift like the ATR one.
  let mean = all.slice(-MEAN_OVER).reduce((sum, c) => sum + c.c, 0) / MEAN_OVER;
  const out: Candle[] = [];
  for (const [id, reversed] of input.cards) {
    const effect = cardEffect(cardById(id), reversed === 1);
    for (let j = 0; j < CANDLES_PER_CARD; j++) {
      const first = j === 0;
      let pull = 0.35;
      let v = 1;
      let shove = 0;
      let shift = 0;
      switch (effect.kind) {
        case "tower":
          v = 1.3;
          pull = 0.2;
          if (first) shove = effect.up ? effect.jump : -effect.jump;
          break;
        case "sun":
          v = 1.1;
          pull = 0.25;
          if (first) shove = effect.up ? effect.jump : -effect.jump;
          break;
        case "wheel":
          if (first) mean = last.c;
          pull = 0.3;
          break;
        case "hanged":
          pull = 0.7;
          v = 0.5;
          break;
        case "moon":
          v = 2;
          pull = 0.25;
          break;
        case "death":
          if (first) mean = 2 * last.c - mean;
          v = 1.2;
          break;
        case "fool":
          pull = 0.1;
          v = 1.6;
          break;
        case "drift":
          shift = (effect.up ? 1 : -1) * 0.25;
          break;
        case "wands":
          shift = ((effect.up ? 1 : -1) * effect.atr) / CANDLES_PER_CARD;
          break;
        case "cups":
          v = effect.wide ? 1.6 : 0.7;
          break;
        case "swords":
          v = 1.2;
          shift = (r() < 0.5 ? -1 : 1) * 0.2;
          break;
        case "pentacles":
          pull = 0.3 + effect.pull / 100;
          v = 0.8;
          break;
      }
      const unitPrice = unit * last.c;
      mean += shift * unitPrice;
      const o = last.c;
      const close = o + pull * (mean + shove * unitPrice - o) + (r() - 0.5) * v * unitPrice;
      let h = Math.max(o, close) + r() * v * unitPrice * 0.6;
      let l = Math.min(o, close) - r() * v * unitPrice * 0.6;
      const missing = MIN_RANGE * unitPrice - (h - l);
      if (missing > 0) {
        h += missing / 2;
        l -= missing / 2;
      }
      const candle: Candle = { t: last.t + HOUR_MS, o, h, l, c: close };
      out.push(candle);
      last = candle;
    }
  }
  return out;
}
