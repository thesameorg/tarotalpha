/**
 * How far the forecast ran from what happened: the mean gap between closes, in ATR of the snapshot. The unit is the
 * market's, not the reader's — measured in each reader's own scale, a reader with a wide unit would look accurate by
 * arithmetic alone, and five readers could not be put side by side. Only candles that already have a real pair count.
 * Where the praise thresholds come from: ../docs/engine.md
 */
import type { Candle } from "./atr";

export interface Deviation {
  compared: number;
  deviation: number | null;
}

export function deviation(forecast: readonly Candle[], real: readonly Candle[], unit: number): Deviation {
  if (!(unit > 0)) throw new RangeError(`deviation needs a unit above zero, got ${String(unit)}`);
  const realByTime = new Map(real.map((candle) => [candle.t, candle]));
  let compared = 0;
  let gap = 0;
  for (const f of forecast) {
    const r = realByTime.get(f.t);
    if (r === undefined) continue;
    compared++;
    gap += Math.abs(f.c - r.c);
  }
  return { compared, deviation: compared === 0 ? null : gap / compared / unit };
}

export type Praise = "close" | "near" | "far";

// Two random walks drift apart with the square root of their length, so the raw gap is divided by it before judging.
const CLOSE = 0.35;
const FAR = 0.9;

export function praise(deviation: number, compared: number): Praise {
  if (compared < 1) throw new RangeError("praise needs at least one compared candle");
  const normalised = deviation / Math.sqrt(compared);
  if (normalised < CLOSE) return "close";
  return normalised < FAR ? "near" : "far";
}
