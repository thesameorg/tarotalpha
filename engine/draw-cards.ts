/**
 * Three distinct cards for one step from one seeded generator. The call order is part of the formula: one number
 * per candidate id, a repeated id costs no extra number, then one number decides the orientation of an accepted card.
 */
import { DECK } from "./deck";
import { makeRng } from "./seed";

export type DrawnCard = readonly [cardId: number, reversed: 0 | 1];
export type StepCards = readonly [DrawnCard, DrawnCard, DrawnCard];

const REVERSED_BELOW = 0.28;

export function drawCards(seed: string): StepCards {
  const r = makeRng(seed);
  const used = new Set<number>();
  const next = (): DrawnCard => {
    for (;;) {
      const id = Math.floor(r() * DECK.length);
      if (used.has(id)) continue;
      used.add(id);
      return [id, r() < REVERSED_BELOW ? 1 : 0];
    }
  };
  return [next(), next(), next()];
}
