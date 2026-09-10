/**
 * Card scans are static files under web/public/cards, one per engine card id, served from /cards.
 * Where they come from and how they were compressed: docs/reference/rider-waite-deck.md.
 */
import { DECK } from "../engine/deck";

export function cardImageUrl(cardId: number): string {
  if (!Number.isInteger(cardId) || cardId < 0 || cardId >= DECK.length)
    throw new RangeError(`card id ${String(cardId)} is outside the ${String(DECK.length)}-card deck`);
  return `/cards/${String(cardId).padStart(2, "0")}.webp`;
}
