import { describe, expect, it } from "vitest";
import { cardById, DECK, MAJOR } from "./deck";

describe("deck", () => {
  it("has 78 cards whose id is their index", () => {
    expect(DECK).toHaveLength(78);
    DECK.forEach((card, index) => {
      expect(card.id).toBe(index);
    });
  });

  it("has 22 majors and 14 cards per suit", () => {
    const majors = DECK.filter((card) => card.arcana === "major");
    expect(majors).toHaveLength(22);
    for (const suit of ["wands", "cups", "swords", "pentacles"] as const) {
      const ranks = DECK.flatMap((card) => (card.arcana === "minor" && card.suit === suit ? [card.rank] : []));
      expect(ranks).toEqual(Array.from({ length: 14 }, (_, i) => i + 1));
    }
  });

  it("addresses cards the way the spec does: majors by index, minors at 22 + suit * 14 + rank - 1", () => {
    expect(cardById(MAJOR.tower)).toEqual({ id: 16, arcana: "major", index: 16 });
    expect(cardById(22)).toEqual({ id: 22, arcana: "minor", suit: "wands", rank: 1 });
    expect(cardById(36)).toEqual({ id: 36, arcana: "minor", suit: "cups", rank: 1 });
    expect(cardById(77)).toEqual({ id: 77, arcana: "minor", suit: "pentacles", rank: 14 });
  });

  it("throws outside 0..77", () => {
    expect(() => cardById(78)).toThrow(RangeError);
    expect(() => cardById(-1)).toThrow(RangeError);
    expect(() => cardById(1.5)).toThrow(RangeError);
  });
});
