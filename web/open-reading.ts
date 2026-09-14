/**
 * The reading currently open on the landing, remembered across a reload. Only a pointer is kept — the id and when
 * it was opened — because the row in D1 already holds the snapshot, the nonce and the cards, and a snapshot copied
 * into the browser would be a second truth that can disagree with the first.
 *
 * The window is an hour: long enough that a reload, a stray tab close or a walk to the kettle does not cost the
 * reading, short enough that nobody resumes a reading whose forecast has already become the past.
 * Why a reading is tied to its tab at all: docs/reading-lifecycle.md
 */
const KEY = "ta.reading.open";
const WINDOW_MS = 60 * 60 * 1000;

interface OpenReading {
  id: string;
  asset: string;
  at: number;
}

/** Remembers the reading open right now, so a reload can pick it up again. */
export function rememberOpen(id: string, asset: string, now = Date.now()): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ id, asset, at: now } satisfies OpenReading));
  } catch {
    // Private mode or a full quota: a reload simply starts a fresh reading, as it always did.
  }
}

/** The id to resume for this instrument, or null when there is none, it went stale, or it was another instrument. */
export function openReadingFor(asset: string, now = Date.now()): string | null {
  const kept = read();
  if (kept === null || kept.asset !== asset) return null;
  if (now - kept.at > WINDOW_MS) {
    forgetOpen();
    return null;
  }
  return kept.id;
}

export function forgetOpen(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing to do: the pointer goes stale on its own within the hour.
  }
}

function read(): OpenReading | null {
  try {
    const { id, asset, at } = JSON.parse(localStorage.getItem(KEY) ?? "") as Record<string, unknown>;
    if (typeof id === "string" && typeof asset === "string" && typeof at === "number") return { id, asset, at };
  } catch {
    // Nothing stored, or something else under the key.
  }
  return null;
}
