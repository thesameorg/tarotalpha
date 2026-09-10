/**
 * A reader is who computes the forecast: the same three cards, different candles. The id is stored with the
 * reading and also seeds the noise, so one seed never gives two readers the same candles and a link replays the
 * reader its author saw. Every reader keeps the shared invariants: eight candles per card, no gap between them
 * and no candle narrower than 0.3 of its own unit. What each mechanic does: docs/reference/forecast-mechanics.md.
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

/** The unit a reader measures a move in: an English label for the tech panel and a fraction of price. */
export interface ReaderScale {
  label: string;
  value: number;
}

export interface Reader {
  forecast: (input: ReaderInput) => Candle[];
  scale: (snapshot: readonly Candle[]) => ReaderScale;
}

const MOVE_OVER = 12;
const BAND_OVER = 20;
const SIGMA_OVER = 24;
const RANGE_OVER = 48;

export const READERS: Record<ReaderId, Reader> = {
  atr: {
    forecast: (input) => cardsToCandles({ ...input, natr: natr(input.snapshot) }),
    scale: (snapshot) => ({ label: "NATR(14)", value: natr(snapshot) }),
  },
  reversion: {
    forecast: meanReversion,
    scale: (snapshot) => ({ label: "BAND(20)", value: bandWidth(snapshot) }),
  },
  analogy: {
    forecast: historyAnalogy,
    scale: (snapshot) => ({ label: "MOVE(12)", value: meanMove(snapshot) }),
  },
  garch: {
    forecast: volatilityClustering,
    scale: (snapshot) => ({ label: "SIGMA(24)", value: sigma(snapshot) }),
  },
  fractal: {
    forecast: fractalDrift,
    scale: (snapshot) => ({ label: "RANGE(48)", value: swing(snapshot) }),
  },
};

export function isReaderId(value: unknown): value is ReaderId {
  return typeof value === "string" && READER_IDS.includes(value as ReaderId);
}

export function readerScale(reader: ReaderId, snapshot: readonly Candle[]): ReaderScale {
  return READERS[reader].scale(snapshot);
}

/** Two standard deviations of the last closes over the last close: how wide the corridor is, as a fraction. */
function bandWidth(snapshot: readonly Candle[]): number {
  const closes = snapshot.slice(-BAND_OVER).map((c) => c.c);
  const last = closes.at(-1);
  if (last === undefined || !(last > 0)) throw new RangeError("bandWidth needs a last close above zero");
  const mean = closes.reduce((sum, c) => sum + c, 0) / closes.length;
  const variance = closes.reduce((sum, c) => sum + (c - mean) ** 2, 0) / closes.length;
  return (2 * Math.sqrt(variance)) / last;
}

/** Standard deviation of the last hourly returns, as a fraction of price: the level the variance comes back to. */
function sigma(snapshot: readonly Candle[]): number {
  const moves = hourlyMoves(snapshot, SIGMA_OVER);
  const mean = moves.reduce((sum, x) => sum + x, 0) / moves.length;
  return Math.sqrt(moves.reduce((sum, x) => sum + (x - mean) ** 2, 0) / moves.length);
}

/** High to low over the last candles against the last close: how far the walk has travelled lately. */
function swing(snapshot: readonly Candle[]): number {
  const tail = snapshot.slice(-RANGE_OVER);
  const last = tail.at(-1);
  if (last === undefined || !(last.c > 0)) throw new RangeError("swing needs a last close above zero");
  return (Math.max(...tail.map((c) => c.h)) - Math.min(...tail.map((c) => c.l))) / last.c;
}

/** The mean absolute hourly move over the last candles, as a fraction of price. */
function meanMove(snapshot: readonly Candle[]): number {
  const moves = hourlyMoves(snapshot, MOVE_OVER);
  return moves.reduce((sum, x) => sum + Math.abs(x), 0) / moves.length;
}

function hourlyMoves(snapshot: readonly Candle[], count: number): number[] {
  const tail = snapshot.slice(-(count + 1));
  const out: number[] = [];
  for (let i = 1; i < tail.length; i++) {
    const prev = tail[i - 1];
    const cur = tail[i];
    if (prev === undefined || cur === undefined || !(prev.c > 0)) continue;
    out.push(cur.c / prev.c - 1);
  }
  if (out.length === 0) throw new RangeError("hourly moves need at least two candles");
  return out;
}
