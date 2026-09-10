-- The verdict of a matured reading: how far every reader's forecast ran from the market, in the snapshot's ATR.
-- Only the score's own readings carry one — `origin = 'beat'`, one per four-hour slot, drawn by the cron — so a
-- shared reading never moves the rating. `attempts` parks a reading whose candles the exchange keeps refusing.
ALTER TABLE readings ADD COLUMN origin TEXT NOT NULL DEFAULT 'share';
ALTER TABLE readings ADD COLUMN scores TEXT;
ALTER TABLE readings ADD COLUMN scored_at INTEGER;
ALTER TABLE readings ADD COLUMN scored_version TEXT;
ALTER TABLE readings ADD COLUMN attempts INTEGER NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX readings_beat_slot ON readings (anchor_ts) WHERE origin = 'beat';
CREATE INDEX readings_unscored ON readings (anchor_ts) WHERE origin = 'beat' AND scored_at IS NULL;
CREATE INDEX readings_scored ON readings (anchor_ts) WHERE origin = 'beat' AND scored_at IS NOT NULL;
