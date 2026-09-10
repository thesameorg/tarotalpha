/**
 * A reader that replays history: it looks for the stretch of the snapshot whose shape is closest to the last hours
 * and copies what happened after it. The card picks which of the close matches to take, which way to turn it and
 * how loud; the mean of the copied stretch is removed, so a rising week does not make every forecast rise.
 * A copy is stretched to the snapshot's scale, or a quiet week of history would draw a flat line of dots next to
 * the other readers. Character: a plausible shape, the market repeating itself. Mechanic and the rest of the
 * shortlist: docs/reference/forecast-mechanics.md.
 */
import { natr, type Candle } from "./atr";
import { CANDLES_PER_CARD, cardEffect } from "./card-effect";
import { cardById } from "./deck";
import type { ReaderInput } from "./readers";
import { makeRng } from "./seed";

const WINDOW = 12;
const TREND_OVER = 24;
const CANDIDATES = 8;
const HOUR_MS = 3_600_000;
// An hourly move of a forecast candle, in ATR: the copied stretch is scaled to this so every reader moves alike.
const TARGET_MOVE = 0.7;
const MIN_RANGE = 0.3;

interface Match {
  start: number;
  distance: number;
}

export function historyAnalogy(input: ReaderInput): Candle[] {
  const r = makeRng(input.noiseSeed);
  const all = [...input.snapshot, ...input.previousForecast];
  let last = all.at(-1);
  const need = WINDOW + CANDLES_PER_CARD + 1;
  if (last === undefined || input.snapshot.length < need) {
    throw new RangeError(`historyAnalogy needs ${String(need)} snapshot candles, got ${String(input.snapshot.length)}`);
  }
  const unit = natr(input.snapshot);
  const past = returns(input.snapshot);
  const query = returns(all).slice(-WINDOW);
  const matches = closest(past, query, unit);
  // The regime, as in the ATR reader: it starts as the snapshot's own trend and only the Wheel and Death flip it.
  // Pointing them straight down instead would make this reader fall on average, whatever the market did.
  const back = all.at(-TREND_OVER);
  let flow = Math.sign(last.c - (back?.c ?? last.c)) || 1;
  const out: Candle[] = [];
  for (const [id, reversed] of input.cards) {
    const effect = cardEffect(cardById(id), reversed === 1);
    let gain = 1;
    let sign = 1;
    let jump = 0;
    let wildest = false;
    switch (effect.kind) {
      case "tower":
        sign = effect.up ? 1 : -1;
        jump = sign * effect.jump;
        gain = 1.3;
        break;
      case "sun":
        sign = effect.up ? 1 : -1;
        jump = sign * effect.jump;
        gain = 1.1;
        break;
      case "wheel":
        flow = -flow;
        sign = flow;
        break;
      case "hanged":
        gain = 0.4;
        break;
      case "moon":
        gain = 1.8;
        break;
      case "death":
        flow = -flow;
        sign = flow;
        gain = 1.2;
        break;
      case "fool":
        gain = 1.5;
        wildest = true;
        break;
      case "drift":
        sign = effect.up ? 1 : -1;
        break;
      case "wands":
        sign = effect.up ? 1 : -1;
        gain = 1 + effect.atr / (CANDLES_PER_CARD * 4);
        break;
      case "cups":
        gain = effect.wide ? 1.5 : 0.7;
        break;
      case "swords":
        gain = 1.2;
        sign = r() < 0.5 ? -1 : 1;
        break;
      case "pentacles":
        gain = 0.8;
        break;
    }
    // The Fool takes the worst of the close matches; every other card picks among them by its own number.
    const picked = matches[wildest ? matches.length - 1 : Math.floor(r() * matches.length)];
    if (picked === undefined) throw new RangeError("historyAnalogy found no match in the snapshot");
    const shape = copied(input.snapshot, past, picked.start, unit);
    for (const [j, move] of shape.entries()) {
      const unitPrice = unit * last.c;
      const o = last.c;
      // Sign and gain scale the log, not the return: eight returns that sum to zero would still multiply to less
      // than one, and the reader would drift down on every reading.
      const close = o * Math.exp(sign * gain * move.log) + (j === 0 ? jump * unitPrice : 0);
      let h = Math.max(o, close) + move.upWick * o * gain;
      let l = Math.min(o, close) - move.downWick * o * gain;
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

function returns(candles: readonly Candle[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const prev = candles[i - 1];
    const cur = candles[i];
    if (prev === undefined || cur === undefined || !(prev.c > 0)) continue;
    out.push(cur.c / prev.c - 1);
  }
  return out;
}

/** The closest stretches by squared distance in units of the snapshot's NATR, best first. */
function closest(past: readonly number[], query: readonly number[], unit: number): Match[] {
  const scored: Match[] = [];
  const lastStart = past.length - WINDOW - CANDLES_PER_CARD;
  for (let start = 0; start <= lastStart; start++) {
    let distance = 0;
    for (let j = 0; j < WINDOW; j++) {
      const a = past[start + j] ?? 0;
      const b = query[j] ?? 0;
      const diff = (a - b) / unit;
      distance += diff * diff;
    }
    scored.push({ start, distance });
  }
  scored.sort((a, b) => a.distance - b.distance);
  return scored.slice(0, CANDIDATES);
}

interface Move {
  /** The move as a log return, centred over the copied stretch: the card's sign and gain scale it in place. */
  log: number;
  upWick: number;
  downWick: number;
}

/** What followed the match: returns with their mean removed and the wicks of those candles, both to scale. */
function copied(snapshot: readonly Candle[], past: readonly number[], start: number, unit: number): Move[] {
  const from = start + WINDOW;
  const raw: number[] = [];
  for (let j = 0; j < CANDLES_PER_CARD; j++) raw.push(past[from + j] ?? 0);
  // Both the centring and the stretch happen in logs. Candles chain multiplicatively, so returns that merely sum
  // to zero still multiply to less than one and would tilt every copied stretch downwards.
  const logs = raw.map((ret) => Math.log(1 + Math.max(ret, -0.9)));
  const mean = logs.reduce((sum, x) => sum + x, 0) / logs.length;
  const centred = logs.map((log) => log - mean);
  const size = centred.reduce((sum, log) => sum + Math.abs(log), 0) / centred.length;
  const stretch = size > 0 ? clamp((unit * TARGET_MOVE) / size, 0.5, 4) : 1;
  return centred.map((log, j) => {
    const scaled = log * stretch;
    const candle = snapshot[from + j + 1];
    if (candle === undefined || !(candle.c > 0)) return { log: scaled, upWick: 0, downWick: 0 };
    const body = Math.max(candle.o, candle.c);
    const floor = Math.min(candle.o, candle.c);
    return {
      log: scaled,
      upWick: ((candle.h - body) / candle.c) * stretch,
      downWick: ((floor - candle.l) / candle.c) * stretch,
    };
  });
}

function clamp(value: number, low: number, high: number): number {
  return Math.min(Math.max(value, low), high);
}
