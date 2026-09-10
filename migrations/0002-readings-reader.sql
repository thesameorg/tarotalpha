-- The reader whose formulas drew the forecast. Readings written before readers existed were all drawn by the ATR one.
ALTER TABLE readings ADD COLUMN reader TEXT NOT NULL DEFAULT 'atr';
