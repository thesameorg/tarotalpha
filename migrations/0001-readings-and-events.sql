-- Readings are written once by "Share" and never change: snapshot and cards are frozen with the engine version.
CREATE TABLE readings (
  id TEXT PRIMARY KEY,
  asset TEXT NOT NULL,
  timeframe TEXT NOT NULL DEFAULT '1H',
  anchor_ts INTEGER NOT NULL,
  source TEXT NOT NULL,
  engine_version TEXT NOT NULL,
  seed_nonce TEXT,
  steps TEXT NOT NULL,
  candles_snapshot TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

-- Funnel journal, one row per event; only the landing counter and the owner's own SQL read it.
CREATE TABLE events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts INTEGER NOT NULL,
  type TEXT NOT NULL,
  asset TEXT,
  reading_id TEXT,
  step INTEGER,
  ip_hash TEXT
);
CREATE INDEX events_ts_type ON events (ts, type);
