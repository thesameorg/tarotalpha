/**
 * The day's summary under the three cards: the engine's digest and effects turned into one paragraph in the current
 * language. Numbers are formatted here, the ruling card named, and a phrasing variant derived from the cards, so the
 * same reading always reads the same.
 */
import { cardById } from "../engine/deck";
import type { StepResult } from "../engine/index";
import { t } from "./i18n/index";

const signed = (x: number): string => `${x < 0 ? "-" : "+"}${Math.abs(x).toFixed(1)}`;

export function daySummary(step: StepResult): string {
  const { digest, effects, cards } = step;
  const position = digest.ruling === 1 || digest.ruling === 2 ? digest.ruling : 0;
  const [id, reversed] = cards[position];
  const ruling = cardById(id);
  return t().summary({
    rulingName: t().cardName(ruling),
    rulingReversed: reversed === 1,
    rulingMajor: ruling.arcana === "major",
    rulingEffect: effects[position],
    rulingPosition: position,
    effects,
    netPct: signed(digest.netPct),
    netAtr: signed(digest.netAtr),
    highPct: signed(digest.highPct),
    lowPct: signed(digest.lowPct),
    direction: digest.direction,
    reversal: digest.reversal,
    variant: cards.reduce((sum, [cardId, flag]) => sum + cardId + flag, 0),
  });
}

/** NATR as the interface prints it: a percent of price with two decimals. */
export function formatAtr(natr: number): string {
  return `${(natr * 100).toFixed(2)} %`;
}
