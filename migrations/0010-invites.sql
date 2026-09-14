-- The code one reader hands out to bring another. It is deliberately not the purse token: that one is a bearer, and
-- a link carrying it would hand the purse, with everything bought in it, to everyone the link was forwarded to.
-- This is a separate opaque name for the same owner, good for nothing but pointing at them.
-- One code per owner, minted on the first ask and never rotated: a link already sent has to keep working.
-- What an invite pays, and what stops it being farmed: docs/wallet.md
CREATE TABLE invites (
  code TEXT PRIMARY KEY,
  owner TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

-- One code per purse, and the index is what makes minting safe against two tabs asking at once.
CREATE UNIQUE INDEX invites_owner ON invites (owner);
