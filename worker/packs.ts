/**
 * What is on the shelf. Prices live here and nowhere else: the client is told what a pack costs, it never says so
 * itself, because a client that names the price names its own. The ledger is dollars in whole cents — floats have no
 * business holding money — and each rail turns cents into its own unit when it writes the offer.
 * Why mana and not days, and where these numbers come from: docs/wallet.md
 */

export interface Pack {
  id: string;
  /** Mana credited when the offer is paid. Zero for the lot that sells an endless purse instead of a number. */
  mana: number;
  /** Price in whole US cents; the TON rail converts, the Stars rail ignores it. */
  cents: number;
  /** Whole Telegram Stars, billed as-is: Telegram converts nothing. */
  stars: number;
  /** Paid once, and no spend draws this purse down again. */
  unlimited?: boolean;
}

/** The lot that sells an endless purse. Its id goes on the offer, and one paid offer of it stops every drawdown. */
export const ENDLESS_PACK = "institutional";

/** The first offer an owner ever pays credits this many times its mana, once per purse. */
export const FIRST_BUY_BONUS = 2;

// Twenty mana to the dollar at the bottom rung, then a bonus that grows with the lot, so every step up reads as the
// better deal. Names come from a trading desk, not from tarot: the joke of this product is the contrast.
export const PACKS: readonly Pack[] = [
  { id: "micro", mana: 40, cents: 199, stars: 120 },
  { id: "standard", mana: 125, cents: 499, stars: 300 },
  { id: "block", mana: 300, cents: 999, stars: 600 },
  { id: "margin", mana: 800, cents: 1999, stars: 1200 },
  { id: ENDLESS_PACK, mana: 0, cents: 9999, stars: 6000, unlimited: true },
];

export function packById(id: unknown): Pack | null {
  return PACKS.find((pack) => pack.id === id) ?? null;
}
