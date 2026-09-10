/** What a dictionary gets to write the day's summary from: numbers already formatted, the ruling card already named. */
import type { CardEffect } from "../../engine/card-effect";
import type { Direction } from "../../engine/step-digest";

export interface SummaryFacts {
  rulingName: string;
  rulingReversed: boolean;
  rulingMajor: boolean;
  rulingEffect: CardEffect;
  rulingPosition: number;
  effects: readonly [CardEffect, CardEffect, CardEffect];
  netPct: string;
  netAtr: string;
  highPct: string;
  lowPct: string;
  direction: Direction;
  reversal: boolean;
  /** Picks between equivalent phrasings; derived from the cards, so one reading always reads the same. */
  variant: number;
}

export function pick(list: readonly string[], variant: number): string {
  return list[Math.abs(variant) % list.length] ?? "";
}
