/**
 * A reader is who computes the forecast: the same three cards, different candles. The id is stored with the
 * reading and also seeds the noise, so one seed never gives two readers the same candles and a link replays the
 * reader its author saw. Every reader keeps the shared invariants: eight candles per card, no gap between them
 * and no candle narrower than 0.3 ATR. What each mechanic does: docs/engine.md.
 */
import { natr, type Candle } from "./atr";
import { cardsToCandles } from "./card-to-candles";
import type { StepCards } from "./draw-cards";
import { fractalDrift } from "./fractal-drift";
import { historyAnalogy } from "./history-analogy";
import { meanReversion } from "./mean-reversion";
import { volatilityClustering } from "./volatility-clustering";

export const READER_IDS = ["atr", "reversion", "analogy", "garch", "fractal"] as const;
export type ReaderId = (typeof READER_IDS)[number];
export const DEFAULT_READER: ReaderId = "atr";

export interface ReaderInput {
  snapshot: readonly Candle[];
  previousForecast: readonly Candle[];
  cards: StepCards;
  noiseSeed: string;
}

export interface Reader {
  forecast: (input: ReaderInput) => Candle[];
}

export const READERS: Record<ReaderId, Reader> = {
  atr: { forecast: (input) => cardsToCandles({ ...input, natr: natr(input.snapshot) }) },
  reversion: { forecast: meanReversion },
  analogy: { forecast: historyAnalogy },
  garch: { forecast: volatilityClustering },
  fractal: { forecast: fractalDrift },
};

export function isReaderId(value: unknown): value is ReaderId {
  return typeof value === "string" && READER_IDS.includes(value as ReaderId);
}
