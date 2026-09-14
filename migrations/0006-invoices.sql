-- Bought mana, unlike the free tank, costs money and therefore cannot live in the browser: what was paid for is here
-- and only the server moves it. `owner` is opaque: `web:<token>` for a browser, `tg:<user_id>` for a verified Mini App
-- user, so the two never share a purse.
--
-- There is no balance column anywhere: the balance is the sum of the paid offers. A counter would need the payment
-- and the increment to land together, and a Worker that dies between them takes the money without the mana; summing
-- makes crediting one conditional UPDATE that is idempotent however many times a webhook is replayed.
-- What is sold and how it is paid for: docs/wallet.md
CREATE TABLE invoices (
  token TEXT PRIMARY KEY,
  owner TEXT NOT NULL,
  mana INTEGER NOT NULL,
  cents INTEGER NOT NULL,
  method TEXT NOT NULL,
  coin TEXT,
  amount TEXT NOT NULL,
  min_amount TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  paid_at INTEGER,
  ext_id TEXT
);

-- The one guard against double credit: a blockchain payment and a Telegram charge each settle exactly one offer.
CREATE UNIQUE INDEX invoices_ext ON invoices (method, ext_id) WHERE ext_id IS NOT NULL;
-- Reading a balance sums this owner's paid offers, so the index carries the balance query as well as the history.
CREATE INDEX invoices_owner ON invoices (owner, paid_at);
