/**
 * A reader where volatility remembers itself: the variance of the next candle is `omega + alpha·shock² +
 * beta·variance`, so one violent hour makes the next hours violent and a quiet stretch stays quiet. The card sets
 * how sharply the variance answers a shock (`alpha`), how long it remembers (`beta`) and where the day leans;
 * the Tower and the Sun feed their jump into the variance too, so the shock echoes instead of passing.
 * Character: quiet zones and bursts. The mechanic: docs/engine.md.
 */
import { natr, type Candle } from "./atr";
import { CANDLES_PER_CARD, cardEffect } from "./card-effect";
import { cardById } from "./deck";
import type { ReaderInput } from "./readers";
import { makeRng } from "./seed";

const HOUR_MS = 3_600_000;
const MIN_RANGE = 0.3;
// The hourly move a calm candle aims at, in ATR, and how far the variance may wander from that in either direction.
const TARGET_MOVE = 0.6;
const FLOOR = 0.1;
const CEILING = 16;
const UNIFORM_UNIT = Math.sqrt(12);

export function volatilityClustering(input: ReaderInput): Candle[] {
  const r = makeRng(input.noiseSeed);
  const all = [...input.snapshot, ...input.previousForecast];
  let last = all.at(-1);
  if (last === undefined) throw new RangeError("volatilityClustering needs at least one candle of history");
  const unit = natr(input.snapshot);
  const target = unit * TARGET_MOVE;
  const base = target * target;
  let variance = base;
  const out: Candle[] = [];
  for (const [id, reversed] of input.cards) {
    const effect = cardEffect(cardById(id), reversed === 1);
    let alpha = 0.25;
    let beta = 0.6;
    let lean = 0;
    let jump = 0;
    switch (effect.kind) {
      case "tower":
        alpha = 0.45;
        beta = 0.5;
        jump = (effect.up ? 1 : -1) * effect.jump;
        break;
      case "sun":
        alpha = 0.35;
        beta = 0.55;
        jump = (effect.up ? 1 : -1) * effect.jump;
        break;
      case "wheel":
        alpha = 0.3;
        lean = 0.2;
        break;
      case "hanged":
        alpha = 0.05;
        beta = 0.85;
        break;
      case "moon":
        alpha = 0.6;
        beta = 0.35;
        break;
      case "death":
        alpha = 0.4;
        lean = -0.2;
        break;
      case "fool":
        alpha = 0.7;
        beta = 0.25;
        break;
      case "drift":
        lean = (effect.up ? 1 : -1) * 0.2;
        break;
      case "wands":
        lean = ((effect.up ? 1 : -1) * effect.atr) / CANDLES_PER_CARD;
        break;
      case "cups":
        alpha = effect.wide ? 0.45 : 0.1;
        beta = effect.wide ? 0.45 : 0.8;
        break;
      case "swords":
        alpha = 0.35;
        lean = (r() < 0.5 ? -1 : 1) * 0.15;
        break;
      case "pentacles":
        alpha = 0.1;
        beta = 0.8 + effect.pull / 500;
        break;
    }
    const omega = base * Math.max(1 - alpha - beta, 0.02);
    for (let j = 0; j < CANDLES_PER_CARD; j++) {
      const unitPrice = unit * last.c;
      const sigma = Math.sqrt(variance);
      const shock = (r() - 0.5) * UNIFORM_UNIT * sigma;
      const o = last.c;
      const close = o * (1 + shock) + (lean * unitPrice + (j === 0 ? jump * unitPrice : 0));
      const move = close / o - 1;
      variance = clamp(omega + alpha * move * move + beta * variance, base * FLOOR, base * CEILING);
      const wick = Math.max(sigma, target * 0.5) * o * 0.6;
      let h = Math.max(o, close) + r() * wick;
      let l = Math.min(o, close) - r() * wick;
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

function clamp(value: number, low: number, high: number): number {
  return Math.min(Math.max(value, low), high);
}
