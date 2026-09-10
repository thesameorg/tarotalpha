import { describe, expect, it } from "vitest";
import type { CardEffect } from "../../engine/card-effect";
import { DECK } from "../../engine/deck";
import type { Direction } from "../../engine/step-digest";
import { DICTIONARIES, LANGS } from "./index";
import type { SummaryFacts } from "./summary-facts";

const TOWER: CardEffect = { kind: "tower", up: false, jump: 3 };
const FACTS: SummaryFacts = {
  rulingName: "X",
  rulingReversed: true,
  rulingMajor: true,
  rulingEffect: TOWER,
  rulingPosition: 0,
  effects: [TOWER, { kind: "hanged" }, { kind: "wands", up: true, atr: 2 }],
  netPct: "+1.3",
  highPct: "+1.8",
  lowPct: "-0.1",
  direction: "up",
  reversal: false,
  variant: 3,
};

describe.each(LANGS.map((entry) => entry.code))("dictionary %s", (code) => {
  const d = DICTIONARIES[code];

  it("names every card, each name once", () => {
    const names = DECK.map((card) => d.cardName(card));
    expect(new Set(names).size).toBe(DECK.length);
    for (const name of names) expect(name.trim()).not.toBe("");
  });

  it("has a different meaning for every card in both orientations", () => {
    for (const card of DECK) {
      const upright = d.meaning(card.id, false);
      const reversed = d.meaning(card.id, true);
      expect(upright.trim()).not.toBe("");
      expect(reversed.trim()).not.toBe("");
      expect(upright).not.toBe(reversed);
    }
  });

  it("labels the link to the method page", () => {
    expect(d.how.trim()).not.toBe("");
  });

  it("writes a summary that carries the number in every direction", () => {
    for (const direction of ["up", "down", "flat"] as Direction[]) {
      for (const reversal of [false, true]) {
        for (const rulingMajor of [false, true]) {
          const text = d.summary({ ...FACTS, direction, reversal, rulingMajor });
          expect(text).toContain("+1.3");
          expect(text.length).toBeGreaterThan(60);
        }
      }
    }
  });

  it("formats prices with Latin digits in its locale", () => {
    expect((1234).toLocaleString(d.locale)).toMatch(/^1.?234$/);
  });
});
