/**
 * ATR as the prototype computes it: a plain mean of the true range over the last `period` candles, no Wilder
 * smoothing. The engine scales every move by NATR, that mean divided by the last close, so "one ATR" is the same
 * fraction of price on a 60 000 coin and on a 0.06 one, and no run of bad cards can push a price below zero.
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

/** ATR over the last close, as a fraction: 0.008 means the hourly true range averages 0.8 % of price. */
export function natr(candles: readonly Candle[], period = 14): number {
  const last = candles[candles.length - 1];
  if (last === undefined || !(last.c > 0)) throw new RangeError("natr needs a last close above zero");
  return atr(candles, period) / last.c;
}
