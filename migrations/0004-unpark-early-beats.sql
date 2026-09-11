-- The sweep used to call a beat reading ripe an hour before its last forecast candle closed, spent all three attempts
-- in that hour and parked it for good. Unscored beat readings get their attempts back; one the exchange really keeps
-- refusing parks again after three more tries.
UPDATE readings SET attempts = 0 WHERE origin = 'beat' AND scored_at IS NULL AND attempts > 0;
