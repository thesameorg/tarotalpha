-- Which lot was sold. The row already carried the mana and the price, but not what was bought, and one lot is not a
-- number of mana at all: paying for it buys an endless purse, and a spend from it draws nothing down. That is a
-- property of the lot, so the lot has to be on the row.
-- Rows written before this column carry an empty id, which matches nothing on the shelf and therefore grants nothing.
-- What is sold and what each lot costs: docs/wallet.md
ALTER TABLE invoices ADD COLUMN pack TEXT NOT NULL DEFAULT '';
