/**
 * How the table stands. On one matured reading the readers are sorted by how far they ran from the market, and only
 * the place counts: the week itself cancels out, so a calm stretch cannot flatter all of them at once and no
 * threshold has to be calibrated. Places fade exponentially — last month's luck stops holding a reader up — and the
 * stars are that same number rounded. Where the number is shown and what it may not claim:
 * ../docs/flows/reading-lifecycle.md
 */
import { READER_IDS, type ReaderId } from "./readers";

/** How far each reader's forecast ran from the market on one reading, in the unit shared by all of them. */
export type Drifts = Partial<Record<ReaderId, number>>;

export interface ReaderRating {
  reader: ReaderId;
  /** −1 is last at every reading, +1 is first at every one, 0 is the middle of the table. */
  rating: number;
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

export function stars(rating: number): number {
  return Math.round(3 + 2 * rating);
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
  return READER_IDS.map((reader) => ({
    reader,
    rating: rating[reader],
    stars: stars(rating[reader]),
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
