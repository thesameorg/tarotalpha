/**
 * ATR as the prototype computes it: a plain mean of the true range over the last `period` candles, no Wilder
 * smoothing. It is the unit every card amplitude is expressed in, so the arithmetic is frozen with engine v1.
 */
export interface Candle {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
}

export function atr(candles: readonly Candle[], period = 14): number {
  const [first, ...rest] = candles.slice(-(period + 1));
  if (period < 1 || first === undefined || rest.length < period) {
    throw new RangeError(`atr(${String(period)}) needs ${String(period + 1)} candles, got ${String(candles.length)}`);
  }
  let sum = 0;
  let prev = first;
  for (const cur of rest) {
    sum += Math.max(cur.h - cur.l, Math.abs(cur.h - prev.c), Math.abs(cur.l - prev.c));
    prev = cur;
  }
  return sum / period;
}
