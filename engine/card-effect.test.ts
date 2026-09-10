import { describe, expect, it } from "vitest";
import { cardEffect } from "./card-effect";
import { cardById, DECK } from "./deck";

describe("card effect", () => {
  it("names the branch and the numbers the sentence about it needs", () => {
    expect(cardEffect(cardById(16), false)).toEqual({ kind: "tower", up: false, jump: 3 });
    expect(cardEffect(cardById(16), true)).toEqual({ kind: "tower", up: true, jump: 3 });
    expect(cardEffect(cardById(19), false)).toEqual({ kind: "sun", up: true, jump: 2 });
    expect(cardEffect(cardById(19), true)).toEqual({ kind: "sun", up: false, jump: 2 });
    expect(cardEffect(cardById(10), true)).toEqual({ kind: "wheel" });
    expect(cardEffect(cardById(12), false)).toEqual({ kind: "hanged" });
    expect(cardEffect(cardById(18), false)).toEqual({ kind: "moon" });
    expect(cardEffect(cardById(13), true)).toEqual({ kind: "death" });
    expect(cardEffect(cardById(0), true)).toEqual({ kind: "fool" });
    expect(cardEffect(cardById(21), false)).toEqual({ kind: "drift", up: true });
    expect(cardEffect(cardById(21), true)).toEqual({ kind: "drift", up: false });
    expect(cardEffect(cardById(1), false)).toEqual({ kind: "drift", up: false });
    expect(cardEffect(cardById(35), false)).toEqual({ kind: "wands", up: true, atr: 4 });
    expect(cardEffect(cardById(22), true)).toEqual({ kind: "wands", up: false, atr: 4 / 14 });
    expect(cardEffect(cardById(36), true)).toEqual({ kind: "cups", wide: false });
    expect(cardEffect(cardById(49), false)).toEqual({ kind: "cups", wide: true });
    expect(cardEffect(cardById(50), false)).toEqual({ kind: "swords" });
    expect(cardEffect(cardById(77), false)).toEqual({ kind: "pentacles", pull: 30 });
    expect(cardEffect(cardById(64), true)).toEqual({ kind: "pentacles", pull: 2 });
  });

  it("has an effect for every card in both orientations", () => {
    for (const card of DECK) {
      expect(typeof cardEffect(card, false).kind).toBe("string");
      expect(typeof cardEffect(card, true).kind).toBe("string");
    }
  });
});
