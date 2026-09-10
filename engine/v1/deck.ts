/**
 * The 78 cards the prototype shuffles. A stored reading addresses a card by id, so the order is part of engine v1:
 * majors 0-21 in Rider-Waite order, minors at 22 + suit * 14 + (rank - 1) with wands, cups, swords, pentacles.
 * Names, glyphs and labels are content shown to the user and stay exactly as in tarot-alpha.html.
 */
export type Suit = "wands" | "cups" | "swords" | "pentacles";

export interface MajorCard {
  id: number;
  arcana: "major";
  index: number;
  name: string;
  glyph: string;
  label: string;
}

export interface MinorCard {
  id: number;
  arcana: "minor";
  suit: Suit;
  rank: number;
  name: string;
  glyph: string;
  label: string;
}

export type Card = MajorCard | MinorCard;

const MAJORS: readonly (readonly [glyph: string, name: string])[] = [
  ["0", "Шут"],
  ["I", "Маг"],
  ["II", "Верховная Жрица"],
  ["III", "Императрица"],
  ["IV", "Император"],
  ["V", "Иерофант"],
  ["VI", "Влюблённые"],
  ["VII", "Колесница"],
  ["VIII", "Сила"],
  ["IX", "Отшельник"],
  ["X", "Колесо Фортуны"],
  ["XI", "Справедливость"],
  ["XII", "Повешенный"],
  ["XIII", "Смерть"],
  ["XIV", "Умеренность"],
  ["XV", "Дьявол"],
  ["XVI", "Башня"],
  ["XVII", "Звезда"],
  ["XVIII", "Луна"],
  ["XIX", "Солнце"],
  ["XX", "Суд"],
  ["XXI", "Мир"],
];

// Every suit glyph ends with U+FE0E so it renders as a text symbol, not an emoji, exactly as the prototype draws it.
const SUITS: readonly { suit: Suit; genitive: string; glyph: string }[] = [
  { suit: "wands", genitive: "Жезлов", glyph: "\u2660\uFE0E" },
  { suit: "cups", genitive: "Кубков", glyph: "\u2665\uFE0E" },
  { suit: "swords", genitive: "Мечей", glyph: "\u2666\uFE0E" },
  { suit: "pentacles", genitive: "Пентаклей", glyph: "\u2663\uFE0E" },
];

const RANKS: readonly string[] = [
  "Туз",
  "Двойка",
  "Тройка",
  "Четвёрка",
  "Пятёрка",
  "Шестёрка",
  "Семёрка",
  "Восьмёрка",
  "Девятка",
  "Десятка",
  "Паж",
  "Рыцарь",
  "Королева",
  "Король",
];

const majors: MajorCard[] = MAJORS.map(([glyph, name], index) => ({
  id: index,
  arcana: "major",
  index,
  name,
  glyph,
  label: `аркан ${glyph}`,
}));

const minors: MinorCard[] = SUITS.flatMap(({ suit, genitive, glyph }, suitIndex) =>
  RANKS.map((rankName, rankIndex) => ({
    id: MAJORS.length + suitIndex * RANKS.length + rankIndex,
    arcana: "minor",
    suit,
    rank: rankIndex + 1,
    name: `${rankName} ${genitive}`,
    glyph,
    label: String(rankIndex + 1).padStart(2, "0"),
  })),
);

export const DECK: readonly Card[] = [...majors, ...minors];

export function cardById(id: number): Card {
  const card = DECK[id];
  if (card === undefined) throw new RangeError(`card id ${String(id)} is outside the ${String(DECK.length)}-card deck`);
  return card;
}
