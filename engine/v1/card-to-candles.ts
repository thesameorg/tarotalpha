/**
 * One step of the forecast: three cards, eight candles each, every amplitude in units of the snapshot ATR.
 * Tables, formulas and the generator call order are in docs/flows/card-to-candles.md. The arithmetic mirrors the
 * prototype's `extrapolate` expression by expression: floating-point evaluation order is part of what a stored
 * reading replays, so do not "simplify" a formula here without a new engine version.
 */
import type { Candle } from "./atr";
import { cardById } from "./deck";
import type { StepCards } from "./draw-cards";
import { makeRng } from "./seed";

export interface StepInput {
  snapshot: readonly Candle[];
  previousForecast: readonly Candle[];
  cards: StepCards;
  atr: number;
  noiseSeed: string;
}

const HOUR_MS = 3_600_000;
const CANDLES_PER_CARD = 8;
const LOOKBACK = 24;

export function cardsToCandles(input: StepInput): Candle[] {
  const A = input.atr;
  const r = makeRng(input.noiseSeed);
  const all = [...input.snapshot, ...input.previousForecast];
  let last = all.at(-1);
  const back = all.at(-LOOKBACK);
  if (last === undefined || back === undefined) {
    throw new RangeError(`cardsToCandles needs ${String(LOOKBACK)} candles of history, got ${String(all.length)}`);
  }
  const ma = all.slice(-LOOKBACK).reduce((s, x) => s + x.c, 0) / LOOKBACK;
  // `dir` is the regime: it starts as the trend sign (flat reads as up) and only the Wheel and Death flip it.
  let dir = Math.sign(last.c - back.c) || 1;
  const out: Candle[] = [];
  for (const [id, reversed] of input.cards) {
    const card = cardById(id);
    const m = card.arcana === "major" ? 1 : card.rank / 14;
    for (let j = 0; j < CANDLES_PER_CARD; j++) {
      const blockStart = j === 0;
      let drift = 0;
      let v = 0.6;
      let gap = 0;
      let pull = 0;
      if (card.arcana === "major") {
        const i = card.index;
        if (i === 16) {
          if (blockStart) gap = -3;
          drift = -0.3;
        } else if (i === 19) {
          if (blockStart) gap = 2;
          drift = 0.2;
        } else if (i === 10) {
          if (blockStart) dir = -dir;
          drift = 0.3 * dir;
        } else if (i === 12) {
          v = 0.2;
        } else if (i === 18) {
          v = 2;
          drift = 0.1 * dir;
        } else if (i === 13) {
          if (blockStart) dir = -dir;
          drift = 0.4 * dir;
        } else {
          drift = ((i - 10.5) / 10.5) * 0.4;
          v = 0.7;
        }
        if (reversed === 1) {
          drift = -drift;
          gap = -gap;
        }
      } else {
        const sg = reversed === 1 ? -1 : 1;
        if (card.suit === "wands") {
          drift = sg * m * 0.5;
        } else if (card.suit === "cups") {
          v = reversed === 1 ? m * 0.4 : m * 1.4;
        } else if (card.suit === "swords") {
          v = m * 1.1;
          drift = sg * (r() < 0.5 ? -1 : 1) * m * 0.35;
        } else {
          pull = m * 0.3;
          v = 0.4;
        }
      }
      const o = last.c + gap * A;
      const close = o + drift * A + (r() - 0.5) * v * A + pull * (ma - o);
      const h = Math.max(o, close) + r() * v * A * 0.6;
      const l = Math.min(o, close) - r() * v * A * 0.6;
      const candle: Candle = { t: last.t + HOUR_MS, o, h, l, c: close };
      out.push(candle);
      last = candle;
    }
  }
  return out;
}
