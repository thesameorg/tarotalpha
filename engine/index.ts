/**
 * The forecast engine: pure formulas, no I/O, no platform imports, one version edited in place. A stored reading
 * keeps its cards and snapshot; the candles are recomputed with whatever formulas are current, so a link may show
 * a different forecast after an engine change — docs/adr/0005-engine-edited-in-place.md. `computeSteps` draws
 * cards and forecasts; `forecastFromCards` replays cards a reading already stores. Both seed the noise with the
 * full seed string, so the version label changes the candles as well as the cards.
 */
import { natr as natrOf, type Candle } from "./atr";
import { cardEffect, type CardEffect } from "./card-effect";
import { READERS, type ReaderId } from "./readers";
import { cardById } from "./deck";
import { drawCards, type DrawnCard, type StepCards } from "./draw-cards";
import { seedString } from "./seed";
import { stepDigest, type StepDigest } from "./step-digest";

export const ENGINE_VERSION = "v2" as const;

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

// The trend looks 24 candles back and ATR(14) needs 15, so the formulas need 25. The product's 168 is the caller's rule.
const MIN_SNAPSHOT = 25;

export function computeSteps(input: ReadingInput & { steps: number }): StepResult[] {
  const cards: StepCards[] = [];
  for (let step = 1; step <= input.steps; step++) cards.push(drawCards(stepSeed(input, step)));
  return forecastFromCards({ ...input, cards });
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

function stepSeed(input: ReadingInput, step: number): string {
  return seedString({
    asset: input.asset,
    anchorTs: input.anchorTs,
    step,
    engineVersion: ENGINE_VERSION,
    nonce: input.nonce,
  });
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
export * from "./card-effect";
export * from "./step-digest";
