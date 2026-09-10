/**
 * Engine v1: pure formulas, no I/O, no platform imports. A version is never deleted — see docs/idea.md, sections 4-5.
 * `computeSteps` draws cards and forecasts; `forecastFromCards` replays cards a reading already stores. Both seed
 * the noise with the full seed string, so unlike the prototype the engine version also changes the candles.
 */
import { atr, type Candle } from "./atr";
import { cardsToCandles } from "./card-to-candles";
import { cardById } from "./deck";
import { drawCards, type DrawnCard, type StepCards } from "./draw-cards";
import { interpret } from "./interpretation";
import { seedString } from "./seed";

export const ENGINE_VERSION = "v1" as const;

export interface StepResult {
  step: number;
  cards: StepCards;
  candles: Candle[];
  interpretation: readonly [string, string, string];
}

export interface ReadingInput {
  asset: string;
  anchorTs: number;
  snapshot: readonly Candle[];
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
  const A = atr(input.snapshot);
  const previousForecast: Candle[] = [];
  const results: StepResult[] = [];
  for (const [index, cards] of input.cards.entries()) {
    const step = index + 1;
    assertStepCards(cards, step);
    const noiseSeed = `noise|${stepSeed(input, step)}`;
    const candles = cardsToCandles({ snapshot: input.snapshot, previousForecast, cards, atr: A, noiseSeed });
    previousForecast.push(...candles);
    const [first, second, third] = cards;
    results.push({ step, cards, candles, interpretation: [sentence(first), sentence(second), sentence(third)] });
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

function sentence([id, reversed]: DrawnCard): string {
  return interpret(cardById(id), reversed === 1);
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
export * from "./accuracy";
export * from "./interpretation";
