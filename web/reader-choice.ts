/**
 * Which reader computes the forecast: chosen under the chart, kept in localStorage, sent with a shared reading and
 * replayed from it. Portraits are static files under web/public/readers, one per reader id, served from /readers;
 * where they come from is docs/reference/reader-portraits.md. Names and methods stay English in every interface
 * language, like the tech panel, because they name a formula and not a feeling.
 * What each mechanic does: docs/reference/forecast-mechanics.md.
 */
import { DEFAULT_READER, isReaderId, type ReaderId } from "../engine/readers";

export interface ReaderFace {
  id: ReaderId;
  name: string;
  method: string;
}

export const READER_FACES: readonly ReaderFace[] = [
  { id: "atr", name: "Madame Vera", method: "ATR noise" },
  { id: "reversion", name: "Sister Anemone", method: "Mean reversion" },
  { id: "analogy", name: "Elder Kofi", method: "History echo" },
  { id: "garch", name: "Mama Ife", method: "Volatility bursts" },
  { id: "fractal", name: "The Weaver", method: "Fractal drift" },
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
  return `/readers/${readerFace(id).id}.webp`;
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
