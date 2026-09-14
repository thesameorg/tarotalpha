-- Where bought mana goes. The balance stays a sum rather than a counter — paid offers minus what was spent — so a
-- Worker that dies mid-request leaves no half-applied number behind; both halves are append-only.
-- Free mana is not here and never will be: it lives in the browser, costs nothing and is worth nothing to forge.
-- What is sold and how it is spent: docs/wallet.md
CREATE TABLE spends (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner TEXT NOT NULL,
  mana INTEGER NOT NULL,
  ts INTEGER NOT NULL
);

-- Reading a balance sums this owner's spends against their paid offers, so the index carries both queries.
CREATE INDEX spends_owner ON spends (owner);
