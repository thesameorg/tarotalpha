/**
 * xmur3 string hash feeding a mulberry32 generator, bit for bit the prototype's `hash` and `rng`. The seed string
 * is what a reading is drawn from: the instrument, the anchor, the day and the reading's own nonce.
 */
function xmur3(str: string): () => number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  };
}

export function makeRng(seed: string): () => number {
  let a = xmur3(seed)();
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface SeedParts {
  asset: string;
  anchorTs: number;
  step: number;
  nonce?: string | null;
}

// The nonce is the fourth field: every reading draws its own, and a row written before that field existed has none.
export function seedString({ asset, anchorTs, step, nonce }: SeedParts): string {
  const base = `${asset}|${String(anchorTs)}|${String(step)}`;
  return nonce === undefined || nonce === null ? base : `${base}|${nonce}`;
}
