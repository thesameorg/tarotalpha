-- Who else was asked about this reading. The author's reader stays in `reader` and never changes — the forecast the
-- link replays is hers — but a viewer may pay to hear the same cards read by other formulas, and their lines have to
-- come back with the link or the second opinion would live only in the tab that bought it.
-- A JSON array of reader ids, never including the author. `NULL` means nobody else was asked.
-- What it costs and why the author is locked: docs/reading-lifecycle.md
ALTER TABLE readings ADD COLUMN opinions TEXT;
