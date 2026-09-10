/**
 * Which reader computes the forecast: chosen under the chart, kept in localStorage, sent with a shared reading and
 * replayed from it. Portraits are static files under web/public/readers, one per reader id, served from /readers;
 * where they come from is docs/reference/reader-portraits.md. Names stay English in every interface language;
 * which formula a reader runs is a technical fact and lives in the tech panel and web/how.html, not next to her.
 * What each mechanic does: docs/reference/forecast-mechanics.md.
 */
import { DEFAULT_READER, isReaderId, type ReaderId } from "../engine/readers";

export interface ReaderFace {
  id: ReaderId;
  name: string;
  /** A paragraph for the profile card. Placeholder copy: nobody has written these yet. */
  blurb: string;
}

export const READER_FACES: readonly ReaderFace[] = [
  {
    id: "atr",
    name: "Madame Vera",
    blurb:
      "Reads the market the plain way: whatever the day's usual swing is, the cards push the price around inside it. No theories, no promises, the oldest hand at the table.",
  },
  {
    id: "reversion",
    name: "Sister Anemone",
    blurb:
      "Believes everything comes back. Her price is pulled to where it has been sitting lately, and a card only decides how hard the rope pulls and how far it is allowed to stray.",
  },
  {
    id: "analogy",
    name: "Elder Kofi",
    blurb:
      "Has seen this week before. He finds the stretch of the past week that looks most like the last few hours and lets it play out again, turned whichever way the cards say.",
  },
  {
    id: "garch",
    name: "Mama Ife",
    blurb:
      "Says trouble travels in company. One violent hour under her hands makes the next hours violent too, and a quiet stretch stays quiet until something breaks it.",
  },
  {
    id: "fractal",
    name: "The Weaver",
    blurb:
      "Works with one thread and one number. Above the middle the moves agree with each other and the price travels far; below it they argue and the day comes out as a fine saw.",
  },
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
