/**
 * What is on the shelf. Prices live here and nowhere else: the client is told what a pack costs, it never says so
 * itself, because a client that names the price names its own. Each rail carries its own price in its own unit and
 * nothing is converted at runtime — tonapi's rate endpoint is documented as display-only, and a quote that drifts
 * between the offer and the signature is a dispute over real money. Why mana and not days: docs/wallet.md
 */

export interface Pack {
  id: string;
  mana: number;
  /** Whole Telegram Stars, billed as-is by the Stars rail. */
  stars: number;
  /** Nanotons, billed as-is by the TON rail. One TON is 1e9. */
  nano: number;
}

export const NANO_PER_TON = 1_000_000_000;

// Provisional, the owner sets both price columns. Each step buys more mana per unit than the one under it, so at
// every rung topping up reads as cheaper than stopping.
export const PACKS: readonly Pack[] = [
  { id: "small", mana: 10, stars: 100, nano: 0.5 * NANO_PER_TON },
  { id: "mid", mana: 30, stars: 250, nano: 1.2 * NANO_PER_TON },
  { id: "large", mana: 70, stars: 500, nano: 2.5 * NANO_PER_TON },
];

export function packById(id: unknown): Pack | null {
  return PACKS.find((pack) => pack.id === id) ?? null;
}
