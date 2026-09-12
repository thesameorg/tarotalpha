/**
 * The stars on a reader's card belong to the Worker, not to the bundle: one number per reader, folded from the
 * verdicts of readings whose horizon has closed. Fetched when a card is first opened and kept for the tab. Until
 * the table has been scored often enough there are no stars at all — a guessed star reads exactly like a measured
 * one. What the number counts: ../docs/reading-lifecycle.md
 */
import { MIN_VERDICTS, type ReaderId } from "../engine/index";
import { fetchReaderTable, type ReaderStanding, type ReaderTable } from "./api";

let table: ReaderTable | null = null;
let pending: Promise<void> | null = null;

/** Resolves once the table is known, or known to be unreachable; one attempt per tab, stars are not worth a retry. */
export function loadReaderTable(): Promise<void> {
  pending ??= fetchReaderTable()
    .then((loaded) => {
      table = loaded;
    })
    .catch(() => undefined);
  return pending;
}

export function readerStanding(id: ReaderId): ReaderStanding | null {
  if (table === null || table.verdicts < MIN_VERDICTS) return null;
  return table.readers.find((entry) => entry.reader === id) ?? null;
}
