/**
 * What a card does to the candles, as data: the branch the formula takes and the numbers the sentence about it
 * needs. Words are the interface's business (web/i18n/), so the sentence can be in any language while the numbers
 * stay the engine's. The branches mirror card-to-candles.ts one to one.
 */
import { MAJOR, RANK_COUNT, type Card } from "./deck";

export const TOWER_JUMP = 3;
export const SUN_JUMP = 2;
export const CANDLES_PER_CARD = 8;

export type CardEffect =
  | { kind: "tower"; up: boolean; jump: number }
  | { kind: "sun"; up: boolean; jump: number }
  | { kind: "wheel" }
  | { kind: "hanged" }
  | { kind: "moon" }
  | { kind: "death" }
  | { kind: "fool" }
  | { kind: "drift"; up: boolean }
  | { kind: "wands"; up: boolean; atr: number }
  | { kind: "cups"; wide: boolean }
  | { kind: "swords" }
  | { kind: "pentacles"; pull: number };

export function cardEffect(card: Card, reversed: boolean): CardEffect {
  if (card.arcana === "major") {
    const i = card.index;
    if (i === MAJOR.tower) return { kind: "tower", up: reversed, jump: TOWER_JUMP };
    if (i === MAJOR.sun) return { kind: "sun", up: !reversed, jump: SUN_JUMP };
    if (i === MAJOR.wheel) return { kind: "wheel" };
    if (i === MAJOR.hanged) return { kind: "hanged" };
    if (i === MAJOR.moon) return { kind: "moon" };
    if (i === MAJOR.death) return { kind: "death" };
    if (i === MAJOR.fool) return { kind: "fool" };
    return { kind: "drift", up: i > 10.5 !== reversed };
  }
  const m = card.rank / RANK_COUNT;
  switch (card.suit) {
    case "wands":
      return { kind: "wands", up: !reversed, atr: m * 0.5 * CANDLES_PER_CARD };
    case "cups":
      return { kind: "cups", wide: !reversed };
    case "swords":
      return { kind: "swords" };
    case "pentacles":
      return { kind: "pentacles", pull: Math.round(m * 30) };
  }
}
