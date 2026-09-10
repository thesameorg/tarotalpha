-- The verdict of a matured reading: how far every reader's forecast ran from the market, in the snapshot's ATR.
-- Written by the sweep on a cron, never by a read. `attempts` parks a reading whose candles the exchange keeps
-- refusing, so one broken symbol cannot hold the queue.
ALTER TABLE readings ADD COLUMN scores TEXT;
ALTER TABLE readings ADD COLUMN scored_at INTEGER;
ALTER TABLE readings ADD COLUMN scored_version TEXT;
ALTER TABLE readings ADD COLUMN attempts INTEGER NOT NULL DEFAULT 0;

CREATE INDEX readings_unscored ON readings (anchor_ts) WHERE scored_at IS NULL;
CREATE INDEX readings_scored ON readings (anchor_ts) WHERE scored_at IS NOT NULL;
