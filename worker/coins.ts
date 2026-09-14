/**
 * What the TON rail takes. The network is still TON; its own coin was renamed Toncoin → Gram in June 2026, so the
 * buyer is shown GRAM while every address, SDK call and endpoint keeps saying TON.
 * A jetton is pinned by its master address and never by its symbol: anyone may mint a coin that calls itself USD₮,
 * and a check by ticker would sell mana for a forgery. Rail end to end: docs/wallet.md
 */

/** Tether on TON, from tonapi's whitelist. Hard-coded on purpose: what we accept must not depend on a live service. */
const USDT_MASTER = "0:b113a994b5024a16719f69139328eb759596c38a25f59028b146fecdc3621dfe";

export interface Coin {
  id: string;
  /** What the buyer reads on the button. */
  symbol: string;
  decimals: number;
  /** Jetton master, raw form; null means the network's own coin. */
  master: string | null;
  /** tonapi rate key, or null for a coin pegged to the dollar, which needs no rate at all. */
  rateToken: string | null;
}

export const COINS: readonly Coin[] = [
  { id: "usdt", symbol: "USD₮", decimals: 6, master: USDT_MASTER, rateToken: null },
  { id: "gram", symbol: "GRAM", decimals: 9, master: null, rateToken: "gram" },
];

export function coinById(id: unknown): Coin | null {
  return COINS.find((coin) => coin.id === id) ?? null;
}
