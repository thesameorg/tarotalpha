/**
 * Which reader computes the forecast: chosen in the header, kept in localStorage, sent with a shared reading and
 * replayed from it. Portraits are cards of the deck, so the choice costs no new assets; names and methods stay
 * English in every interface language, like the tech panel, because they name a formula and not a feeling.
 * What each mechanic does: docs/reference/forecast-mechanics.md.
 */
import { DEFAULT_READER, isReaderId, type ReaderId } from "../engine/readers";
import { cardImageUrl } from "./card-image";

export interface ReaderFace {
  id: ReaderId;
  name: string;
  method: string;
  /** The card whose scan stands in for a portrait until drawn ones exist. */
  card: number;
}

export const READER_FACES: readonly ReaderFace[] = [
  { id: "atr", name: "The Magician", method: "ATR noise", card: 1 },
  { id: "reversion", name: "Temperance", method: "Mean reversion", card: 14 },
  { id: "analogy", name: "The Wheel", method: "History echo", card: 10 },
  { id: "garch", name: "The Moon", method: "Volatility bursts", card: 18 },
  { id: "fractal", name: "The Hermit", method: "Fractal drift", card: 9 },
];

const STORAGE_KEY = "ta.reader";
const listeners = new Set<() => void>();
let choice: ReaderId = DEFAULT_READER;

export function reader(): ReaderId {
  return choice;
}

export function readerFace(id: ReaderId): ReaderFace {
  const face = READER_FACES.find((f) => f.id === id);
  if (face === undefined) throw new RangeError(`reader ${id} has no face`);
  return face;
}

export function readerAvatarUrl(id: ReaderId): string {
  return cardImageUrl(readerFace(id).card);
}

export function initReader(): void {
  const stored = read();
  choice = isReaderId(stored) ? stored : DEFAULT_READER;
  apply();
}

export function setReader(next: ReaderId): void {
  if (next === choice) return;
  choice = next;
  store(next);
  apply();
  for (const listener of listeners) listener();
}

export function onReaderChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The card backs follow the reader: one pattern per reader, painted from `data-reader` in styles.css. */
function apply(): void {
  document.documentElement.dataset.reader = choice;
}

function read(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function store(value: ReaderId): void {
  try {
    localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // Private mode or a full quota: the choice lives until the tab closes.
  }
}
