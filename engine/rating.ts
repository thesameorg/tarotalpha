/**
 * How the table stands. On one matured reading the readers are sorted by how far they ran from the market, and only
 * the place counts: the week itself cancels out, so a calm stretch cannot flatter all of them at once and no
 * threshold has to be calibrated. Places fade exponentially — last month's luck stops holding a reader up. Stars are
 * a place at this table and not a mark out of five: five similar mechanics all sit near the middle, so the ratings
 * are spread across the scale against each other. Where the number is shown and what it may not claim:
 * ../docs/flows/reading-lifecycle.md
 */
import { READER_IDS, type ReaderId } from "./readers";

/** How far each reader's forecast ran from the market on one reading, in the unit shared by all of them. */
export type Drifts = Partial<Record<ReaderId, number>>;

export interface ReaderRating {
  reader: ReaderId;
  /** −1 is last at every reading, +1 is first at every one, 0 is the middle of the table. */
  rating: number;
  /** 1 to 5 in halves, spread across the table rather than measured against an absolute mark. */
  stars: number;
  /** Share of the counted readings where nobody at the table was closer to the market. */
  wins: number;
  verdicts: number;
}

// Twenty readings of memory: half of a place is forgotten in fourteen, so the stars keep moving.
const SMOOTHING = 2 / (20 + 1);

/** Below this the stars would be noise, and the card says the table has not been scored instead. */
export const MIN_VERDICTS = 10;

/** A place is worth +1 down to −1 whatever the size of the table, so a sixth reader would not rescale the stars. */
export function places(drifts: Required<Drifts>): Record<ReaderId, number> {
  const order = [...READER_IDS].sort((a, b) => drifts[a] - drifts[b]);
  const last = order.length - 1;
  return Object.fromEntries(order.map((id, index) => [id, 1 - (2 * index) / last])) as Record<ReaderId, number>;
}

const MIDDLE = 3;
const LIMIT = { low: 1, high: 5 };

// Stars for the table at once: the middle of the scale is the middle of the table, one deviation is one star, and
// a full five needs a reader two deviations clear of the rest. Ratings sum to zero, so only the scale is found.
export function starsAcross(ratings: readonly number[]): number[] {
  const spread = Math.sqrt(ratings.reduce((sum, rating) => sum + rating * rating, 0) / ratings.length);
  if (spread === 0) return ratings.map(() => MIDDLE);
  return ratings.map((rating) => halves(Math.min(LIMIT.high, Math.max(LIMIT.low, MIDDLE + rating / spread))));
}

function halves(stars: number): number {
  return Math.round(stars * 2) / 2;
}

/** Verdicts oldest first: the fold is exponential, so the order is the whole point. */
export function ratings(verdicts: readonly Drifts[]): ReaderRating[] {
  const rating = blank();
  const wins = blank();
  let counted = 0;
  for (const drifts of verdicts) {
    if (!scoresEveryReader(drifts)) continue;
    counted++;
    const place = places(drifts);
    for (const id of READER_IDS) {
      rating[id] += SMOOTHING * (place[id] - rating[id]);
      if (place[id] === 1) wins[id]++;
    }
  }
  const stars = starsAcross(READER_IDS.map((id) => rating[id]));
  return READER_IDS.map((reader, index) => ({
    reader,
    rating: rating[reader],
    stars: stars[index] ?? MIDDLE,
    wins: counted === 0 ? 0 : wins[reader] / counted,
    verdicts: counted,
  }));
}

// A verdict written before a reader joined the table cannot place her, and half a table has no places at all.
function scoresEveryReader(drifts: Drifts): drifts is Required<Drifts> {
  return READER_IDS.every((id) => typeof drifts[id] === "number" && Number.isFinite(drifts[id]));
}

function blank(): Record<ReaderId, number> {
  return Object.fromEntries(READER_IDS.map((id) => [id, 0])) as Record<ReaderId, number>;
}
