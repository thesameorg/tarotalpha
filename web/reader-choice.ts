/**
 * Which reader computes the forecast: chosen beside the day tabs, kept in localStorage, sent with a shared reading and
 * replayed from it. Portraits are static files under web/public/readers, one per reader id, served from /readers;
 * where they come from is docs/assets.md. What she is called and the paragraph about her are
 * text and live in the dictionaries (web/i18n/readers-*.ts), so both follow the interface language; the id never
 * does. What each mechanic does: docs/engine.md.
 */
import { DEFAULT_READER, isReaderId, type ReaderId } from "../engine/readers";

const STORAGE_KEY = "ta.reader";
const listeners = new Set<() => void>();
let choice: ReaderId = DEFAULT_READER;
let locked = false;

export function reader(): ReaderId {
  return choice;
}

/** Whether the choice is held: a forecast is one reader's from its first open day, so nothing switches it then. */
export function readerLocked(): boolean {
  return locked;
}

export function lockReader(on: boolean): void {
  if (on === locked) return;
  locked = on;
  for (const listener of listeners) listener();
}

export function readerAvatarUrl(id: ReaderId): string {
  return `/readers/${id}.webp`;
}

export function initReader(): void {
  const stored = read();
  choice = isReaderId(stored) ? stored : DEFAULT_READER;
  apply();
}

export function setReader(next: ReaderId): void {
  if (next === choice || locked) return;
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
