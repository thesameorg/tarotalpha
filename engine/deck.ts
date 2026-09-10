/**
 * The 78 cards, addressed by id: majors 0-21 in Rider-Waite order, minors at 22 + suit * 14 + (rank - 1) with
 * wands, cups, swords, pentacles. A stored reading keeps ids, so this order never changes. Names are content and
 * live with the interface languages in web/i18n/.
 */
export type Suit = "wands" | "cups" | "swords" | "pentacles";

export interface MajorCard {
  id: number;
  arcana: "major";
  index: number;
}

export interface MinorCard {
  id: number;
  arcana: "minor";
  suit: Suit;
  rank: number;
}

export type Card = MajorCard | MinorCard;

export const SUITS: readonly Suit[] = ["wands", "cups", "swords", "pentacles"];
export const MAJOR_COUNT = 22;
export const RANK_COUNT = 14;

/** The majors the formula treats specially, by Rider-Waite index. */
export const MAJOR = { fool: 0, wheel: 10, hanged: 12, death: 13, tower: 16, moon: 18, sun: 19 } as const;

const majors: MajorCard[] = Array.from({ length: MAJOR_COUNT }, (_, index) => ({ id: index, arcana: "major", index }));

const minors: MinorCard[] = SUITS.flatMap((suit, suitIndex) =>
  Array.from({ length: RANK_COUNT }, (_, rankIndex) => ({
    id: MAJOR_COUNT + suitIndex * RANK_COUNT + rankIndex,
    arcana: "minor" as const,
    suit,
    rank: rankIndex + 1,
  })),
);

export const DECK: readonly Card[] = [...majors, ...minors];

export function cardById(id: number): Card {
  const card = DECK[id];
  if (card === undefined) throw new RangeError(`card id ${String(id)} is outside the ${String(DECK.length)}-card deck`);
  return card;
}
