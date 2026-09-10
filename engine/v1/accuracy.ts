/**
 * Prophecy check: a forecast candle scores a hit when its direction matches the real candle opened at the same
 * time. Only candles that already have a real pair count, so `accuracy` is null until the future has happened.
 */
import type { Candle } from "./atr";

export interface Accuracy {
  compared: number;
  hits: number;
  accuracy: number | null;
}

export function accuracy(forecast: readonly Candle[], real: readonly Candle[]): Accuracy {
  const realByTime = new Map(real.map((candle) => [candle.t, candle]));
  let compared = 0;
  let hits = 0;
  for (const f of forecast) {
    const r = realByTime.get(f.t);
    if (r === undefined) continue;
    compared++;
    const forecastUp = f.c >= f.o;
    const realUp = r.c >= r.o;
    if (forecastUp === realUp) hits++;
  }
  return { compared, hits, accuracy: compared === 0 ? null : hits / compared };
}
