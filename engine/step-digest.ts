/**
 * The facts of one step the interface builds the day's summary from: net move as a fraction of price and in ATR
 * units, the extremes, which card rules the day and whether the regime flipped. Numbers only; the words are the
 * interface's (web/spread-summary.ts).
 */
import type { Candle } from "./atr";
import { cardById, MAJOR, type Card } from "./deck";
import type { StepCards } from "./draw-cards";

export type Direction = "up" | "down" | "flat";

export interface StepDigest {
  netPct: number;
  netAtr: number;
  highPct: number;
  lowPct: number;
  direction: Direction;
  /** Position (0-2) of the card that rules the day: the strongest major, else the highest minor. */
  ruling: number;
  reversal: boolean;
}

const FLAT_BELOW_ATR = 0.5;
// Majors that rewrite the regime outrank the ones that only drift; a tie goes to the earlier position.
const MAJOR_RANK: readonly number[] = [
  MAJOR.tower,
  MAJOR.sun,
  MAJOR.death,
  MAJOR.wheel,
  MAJOR.moon,
  MAJOR.hanged,
  MAJOR.fool,
];

export function stepDigest(cards: StepCards, candles: readonly Candle[], natr: number): StepDigest {
  const first = candles[0];
  const last = candles[candles.length - 1];
  if (first === undefined || last === undefined) throw new RangeError("stepDigest needs at least one candle");
  const open = first.o;
  const high = Math.max(...candles.map((c) => c.h));
  const low = Math.min(...candles.map((c) => c.l));
  const netAtr = (last.c - open) / (natr * open);
  const direction: Direction = Math.abs(netAtr) < FLAT_BELOW_ATR ? "flat" : netAtr > 0 ? "up" : "down";
  return {
    netPct: (last.c / open - 1) * 100,
    netAtr,
    highPct: (high / open - 1) * 100,
    lowPct: (low / open - 1) * 100,
    direction,
    ruling: rulingPosition(cards),
    reversal: cards.some(([id]) => flipsRegime(cardById(id))),
  };
}

function flipsRegime(card: Card): boolean {
  return card.arcana === "major" && (card.index === MAJOR.wheel || card.index === MAJOR.death);
}

function rulingPosition(cards: StepCards): number {
  let best = 0;
  let bestScore = -Infinity;
  cards.forEach(([id], position) => {
    const card = cardById(id);
    const score = card.arcana === "major" ? 100 + majorWeight(card.index) : card.rank;
    if (score > bestScore) {
      best = position;
      bestScore = score;
    }
  });
  return best;
}

function majorWeight(index: number): number {
  const rank = MAJOR_RANK.indexOf(index);
  return rank < 0 ? 0 : MAJOR_RANK.length - rank;
}
