-- The funnel journal is an Analytics Engine dataset now: its own write budget, three months of history and SQL over
-- HTTP, so a viral day cannot spend a reading's D1 write on a row of statistics (docs/analytics.md).
DROP TABLE IF EXISTS events;
