/**
 * A reader tuned by one number, the Hurst exponent: above 0.5 the moves agree with each other and the price
 * travels, below 0.5 they argue and it saws. Each candle is a weighted sum of the last shocks with the weights of
 * fractional Brownian motion, `(k+1)^(H−0.5) − k^(H−0.5)`, normalised so the width stays the same whatever H, so
 * the card changes the character of the walk and never its scale. Character: long smooth runs or a fine saw.
 * The mechanic: docs/engine.md.
 */
import { natr, type Candle } from "./atr";
import { CANDLES_PER_CARD, cardEffect } from "./card-effect";
import { cardById } from "./deck";
import type { ReaderInput } from "./readers";
import { makeRng } from "./seed";

const HOUR_MS = 3_600_000;
const MIN_RANGE = 0.3;
const MEMORY = 12;
const TARGET_MOVE = 0.6;
const UNIFORM_UNIT = Math.sqrt(12);

export function fractalDrift(input: ReaderInput): Candle[] {
  const r = makeRng(input.noiseSeed);
  const all = [...input.snapshot, ...input.previousForecast];
  let last = all.at(-1);
  if (last === undefined) throw new RangeError("fractalDrift needs at least one candle of history");
  const unit = natr(input.snapshot);
  // The memory starts full: an empty one would make the first candles of a reading quieter than the rest.
  const shocks: number[] = Array.from({ length: MEMORY }, () => (r() - 0.5) * UNIFORM_UNIT);
  const out: Candle[] = [];
  for (const [id, reversed] of input.cards) {
    const effect = cardEffect(cardById(id), reversed === 1);
    let hurst = 0.5;
    let gain = 1;
    let lean = 0;
    let jump = 0;
    switch (effect.kind) {
      case "tower":
        hurst = 0.8;
        gain = 1.2;
        jump = (effect.up ? 1 : -1) * effect.jump;
        break;
      case "sun":
        hurst = 0.75;
        jump = (effect.up ? 1 : -1) * effect.jump;
        break;
      case "wheel":
        hurst = 0.7;
        lean = 0.2;
        break;
      case "hanged":
        hurst = 0.2;
        gain = 0.6;
        break;
      case "moon":
        hurst = 0.35;
        gain = 1.7;
        break;
      case "death":
        hurst = 0.7;
        lean = -0.25;
        break;
      case "fool":
        hurst = 0.5;
        gain = 1.5;
        break;
      case "drift":
        hurst = effect.up ? 0.68 : 0.32;
        lean = (effect.up ? 1 : -1) * 0.15;
        break;
      case "wands":
        hurst = 0.65;
        lean = ((effect.up ? 1 : -1) * effect.atr) / CANDLES_PER_CARD;
        break;
      case "cups":
        hurst = 0.45;
        gain = effect.wide ? 1.5 : 0.7;
        break;
      case "swords":
        hurst = 0.3;
        gain = 1.2;
        break;
      case "pentacles":
        hurst = 0.4;
        gain = 0.8;
        break;
    }
    const weights = fractionalWeights(hurst);
    for (let j = 0; j < CANDLES_PER_CARD; j++) {
      shocks.unshift((r() - 0.5) * UNIFORM_UNIT);
      shocks.length = MEMORY;
      let sum = 0;
      for (const [k, weight] of weights.entries()) sum += weight * (shocks[k] ?? 0);
      const unitPrice = unit * last.c;
      const o = last.c;
      const move = sum * gain * TARGET_MOVE + lean + (j === 0 ? jump : 0);
      const close = o + move * unitPrice;
      const wick = Math.max(Math.abs(sum) * gain, 0.4) * TARGET_MOVE;
      let h = Math.max(o, close) + r() * wick * unitPrice * 0.6;
      let l = Math.min(o, close) - r() * wick * unitPrice * 0.6;
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

/** Mandelbrot-Van Ness weights, normalised. The k = 0 weight is 1: computing it below H = 0.5 gives infinity. */
function fractionalWeights(hurst: number): number[] {
  const power = hurst - 0.5;
  const raw = Array.from({ length: MEMORY }, (_, k) => (k === 0 ? 1 : (k + 1) ** power - k ** power));
  const norm = Math.sqrt(raw.reduce((sum, w) => sum + w * w, 0));
  return raw.map((w) => w / norm);
}
