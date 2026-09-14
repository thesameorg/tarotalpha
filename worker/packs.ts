/**
 * What is on the shelf. Prices live here and nowhere else: the client is told what a pack costs, it never says so
 * itself, because a client that names the price names its own. The ledger is dollars in whole cents — floats have no
 * business holding money — and each rail turns cents into its own unit when it writes the offer.
 * Why mana and not days: docs/wallet.md
 */

export interface Pack {
  id: string;
  mana: number;
  /** Price in whole US cents; the TON rail converts, the Stars rail ignores it. */
  cents: number;
  /** Whole Telegram Stars, billed as-is: Telegram converts nothing. */
  stars: number;
}

// Test prices, a hundredth of the real ones, so a rail can be exercised for the cost of nothing. Each step buys
// more mana per dollar than the one under it, so at every rung topping up reads as cheaper than stopping.
export const PACKS: readonly Pack[] = [
  { id: "small", mana: 10, cents: 2, stars: 1 },
  { id: "mid", mana: 30, cents: 5, stars: 3 },
  { id: "large", mana: 70, cents: 10, stars: 7 },
];

export function packById(id: unknown): Pack | null {
  return PACKS.find((pack) => pack.id === id) ?? null;
}
