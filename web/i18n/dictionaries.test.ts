import { describe, expect, it } from "vitest";
import type { CardEffect } from "../../engine/card-effect";
import { DECK } from "../../engine/deck";
import { READER_IDS } from "../../engine/readers";
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

// Markup names its text by a path the type checker cannot follow: a renamed key would leave the element empty.
const MARKUP: Record<string, string> = import.meta.glob(["../*.html", "../*.ts"], {
  query: "?raw",
  import: "default",
  eager: true,
});
const STATIC_KEYS = [
  ...new Set(
    Object.values(MARKUP).flatMap((source) =>
      [...source.matchAll(/data-i18n="([^"]+)"/g)]
        .flatMap((match) => (match[1] ?? "").split(";"))
        .filter((spec) => !spec.includes("${"))
        .map((spec) => spec.split("@")[0] ?? ""),
    ),
  ),
];

function textAt(dictionary: object, keyPath: string): unknown {
  let node: unknown = dictionary;
  for (const key of keyPath.split(".")) node = (node as Record<string, unknown> | undefined)?.[key];
  return node;
}

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

  it("names every reader, each name once", () => {
    const names = READER_IDS.map((id) => d.readerName(id));
    expect(new Set(names).size).toBe(READER_IDS.length);
    for (const name of names) expect(name.trim()).not.toBe("");
  });

  it("writes a paragraph about every reader", () => {
    for (const id of READER_IDS) expect(d.readerBlurb(id).trim()).not.toBe("");
  });

  it("has text for every data-i18n path in the markup", () => {
    expect(STATIC_KEYS.length).toBeGreaterThan(10);
    for (const key of STATIC_KEYS) {
      const text = textAt(d, key);
      expect(typeof text === "string" && text.trim() !== "", `${code}: ${key}`).toBe(true);
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
