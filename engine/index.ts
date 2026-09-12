/**
 * The forecast engine: pure formulas, no I/O, no platform imports, edited in place. A stored reading keeps its
 * cards, its nonce and its snapshot; the candles are recomputed with whatever formulas are current, so a link may
 * show a different forecast after an engine change — docs/engine.md. `computeSteps` draws cards and forecasts;
 * `forecastFromCards` replays cards a reading already stores. Both seed the noise with the full seed string, so a
 * reading's nonce moves its candles as well as its cards.
 */
import { natr as natrOf, type Candle } from "./atr";
import { CANDLES_PER_CARD, cardEffect, type CardEffect } from "./card-effect";
import { READERS, type ReaderId } from "./readers";
import { cardById } from "./deck";
import { drawCards, type DrawnCard, type StepCards } from "./draw-cards";
import { seedString } from "./seed";
import { stepDigest, type StepDigest } from "./step-digest";

// The horizon: a week ahead, as long as the snapshot behind the anchor. `cpu-budget.test.ts` measures this many steps.
export const MAX_STEPS = 7;
// Three cards of eight candles: one step is a day ahead.
export const CANDLES_PER_STEP = 3 * CANDLES_PER_CARD;

export interface StepResult {
  step: number;
  cards: StepCards;
  candles: Candle[];
  effects: readonly [CardEffect, CardEffect, CardEffect];
  digest: StepDigest;
}

export interface ReadingInput {
  asset: string;
  anchorTs: number;
  snapshot: readonly Candle[];
  reader: ReaderId;
  nonce?: string | null;
}

/** What the cards are drawn from: no candles and no reader, because neither moves the shuffle. */
export interface DrawInput {
  asset: string;
  anchorTs: number;
  nonce?: string | null;
  steps: number;
}

// The trend looks 24 candles back and ATR(14) needs 15, so the formulas need 25. The product's 168 is the caller's rule.
const MIN_SNAPSHOT = 25;

export function computeSteps(input: ReadingInput & { steps: number }): StepResult[] {
  return forecastFromCards({ ...input, cards: drawSteps(input) });
}

/** The cards of a reading without its candles: all a caller needs to store them or to match a client's draw. */
export function drawSteps(input: DrawInput): StepCards[] {
  const cards: StepCards[] = [];
  for (let step = 1; step <= input.steps; step++) cards.push(drawCards(stepSeed(input, step)));
  return cards;
}

export function forecastFromCards(input: ReadingInput & { cards: readonly StepCards[] }): StepResult[] {
  if (input.snapshot.length < MIN_SNAPSHOT) {
    throw new RangeError(
      `snapshot needs at least ${String(MIN_SNAPSHOT)} candles, got ${String(input.snapshot.length)}`,
    );
  }
  const natr = natrOf(input.snapshot);
  const previousForecast: Candle[] = [];
  const results: StepResult[] = [];
  for (const [index, cards] of input.cards.entries()) {
    const step = index + 1;
    assertStepCards(cards, step);
    const noiseSeed = `noise|${input.reader}|${stepSeed(input, step)}`;
    const candles = READERS[input.reader].forecast({ snapshot: input.snapshot, previousForecast, cards, noiseSeed });
    previousForecast.push(...candles);
    const [first, second, third] = cards;
    results.push({
      step,
      cards,
      candles,
      effects: [effectOf(first), effectOf(second), effectOf(third)],
      digest: stepDigest(cards, candles, natr),
    });
  }
  return results;
}

function stepSeed(input: Omit<DrawInput, "steps">, step: number): string {
  return seedString({ asset: input.asset, anchorTs: input.anchorTs, step, nonce: input.nonce });
}

function effectOf([id, reversed]: DrawnCard): CardEffect {
  return cardEffect(cardById(id), reversed === 1);
}

// Stored cards arrive as JSON, so the tuple shape is checked at runtime and not only by the type.
function assertStepCards(cards: readonly (readonly [number, number])[], step: number): void {
  if (cards.length !== 3) throw new RangeError(`step ${String(step)}: expected 3 cards, got ${String(cards.length)}`);
  for (const [id, reversed] of cards) {
    if (reversed !== 0 && reversed !== 1) {
      throw new RangeError(
        `step ${String(step)}: card ${String(id)} orientation must be 0 or 1, got ${String(reversed)}`,
      );
    }
  }
}

export * from "./deck";
export * from "./seed";
export * from "./draw-cards";
export * from "./atr";
export * from "./card-to-candles";
export * from "./readers";
export * from "./accuracy";
export * from "./deviation";
export * from "./rating";
export * from "./card-effect";
export * from "./step-digest";
