-- The engine label selected nothing: the cards come from the reading's own nonce, and a stale tab is caught by the
-- cards it sends. The verdict keeps `scored_at`; which formulas scored it is not recoverable from a label either.
ALTER TABLE readings DROP COLUMN engine_version;
ALTER TABLE readings DROP COLUMN scored_version;
