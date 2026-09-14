/**
 * The purse on this side of the wire. It holds one thing of its own — the bearer token that names the browser's
 * wallet — and asks the Worker for everything else: the shelf, the balance, an offer, and whether an offer is paid.
 * Prices are never computed here; a client that names the price names its own. Inside Telegram the signed launch
 * data identifies the buyer instead, and the token is not used at all. Rails end to end: docs/wallet.md
 */
import { telegram } from "./telegram";

const OWNER_KEY = "ta.wallet";
// Nine decimals of Gram is a number nobody reads; four is a price, and the offer carries slack for the rest.
const SHOWN_DECIMALS = 4;

export interface Pack {
  id: string;
  mana: number;
  cents: number;
  stars: number;
  /** Sells an endless purse; for this one the mana number means nothing and the shelf shows a sign instead. */
  unlimited?: boolean;
}

export interface Coin {
  id: string;
  symbol: string;
  decimals: number;
}

export interface Shelf {
  balance: number;
  /** This purse cannot run out: spends do not draw it down. */
  unlimited: boolean;
  packs: readonly Pack[];
  coins: readonly Coin[];
  rails: { ton: boolean; stars: boolean };
}

export interface ChainOffer {
  token: string;
  coin: string;
  symbol: string;
  decimals: number;
  /** Where the payment goes. */
  address: string;
  /** Jetton master for a deep link; null for the network's own coin. */
  master: string | null;
  /** In the coin's smallest unit, as a decimal string. */
  amount: string;
  /** What the wallet must put in the comment field, which some wallets call memo or note. */
  comment: string;
}

export interface StarsOffer {
  token: string;
  invoice_link: string;
}

/** The headline figure: at most four decimals, rounded up, so nobody who pays what they read underpays. */
export function shortAmount(units: string, decimals: number): string {
  const full = humanAmount(units, decimals);
  const dot = full.indexOf(".");
  if (dot < 0 || full.length - dot - 1 <= SHOWN_DECIMALS) return full;
  const step = 10 ** SHOWN_DECIMALS;
  return (Math.ceil(Number(full) * step) / step).toFixed(SHOWN_DECIMALS).replace(/0+$/, "").replace(/\.$/, "");
}

/** Whole units of the coin, the way a person reads them: 4990000 of a six-decimal coin is "4.99". */
export function humanAmount(units: string, decimals: number): string {
  const padded = units.padStart(decimals + 1, "0");
  const whole = padded.slice(0, padded.length - decimals);
  const fraction = padded.slice(padded.length - decimals).replace(/0+$/, "");
  return fraction === "" ? whole : `${whole}.${fraction}`;
}

/** The link that opens a wallet with everything already filled in. Wallets that ignore it still take a copy-paste. */
export function walletLink(offer: ChainOffer): string {
  const query = new URLSearchParams({ amount: offer.amount, text: offer.comment });
  if (offer.master !== null) query.set("jetton", offer.master);
  return `ton://transfer/${offer.address}?${query.toString()}`;
}

export async function shelf(): Promise<Shelf> {
  return await call<Shelf>("/api/wallet");
}

export async function offerChain(pack: string, coin: string): Promise<ChainOffer> {
  return await call<ChainOffer>("/api/wallet/invoice", { pack, method: "ton", coin });
}

export async function offerStars(pack: string): Promise<StarsOffer> {
  return await call<StarsOffer>("/api/wallet/invoice", { pack, method: "stars" });
}

/** What the Worker says is left of this purse's bought mana, and whether it can run out at all. */
export async function walletPurse(): Promise<{ balance: number; unlimited: boolean }> {
  const { balance, unlimited } = await shelf();
  return { balance, unlimited };
}

/** Spends bought mana on the Worker, which is the only side allowed to decide there was enough. */
export async function spendPaid(mana: number): Promise<number> {
  const { balance } = await call<{ balance: number }>("/api/wallet/spend", { mana });
  return balance;
}

/** This purse's invite code: the same one every time, because a link already handed out has to keep working. */
export async function inviteCode(): Promise<string> {
  return (await call<{ code: string }>("/api/wallet/invite")).code;
}

/** Tells the Worker which code brought this purse here; the mana goes to whoever sent it, never to the newcomer. */
export async function redeemInvite(code: string, reading: string): Promise<number> {
  return (await call<{ mana: number }>("/api/wallet/invited", { code, reading })).mana;
}

/** The buyer's own jetton wallet for this coin: only a keyed client may ask the chain, so the Worker asks. */
export async function jettonWalletFor(coin: string, from: string): Promise<string> {
  const { wallet } = await call<{ wallet: string }>("/api/wallet/jetton", { coin, from });
  return wallet;
}

/** The balance after this offer settled, or null while the payment has not shown up on chain yet. */
export async function claim(token: string): Promise<number | null> {
  try {
    const { balance } = await call<{ balance: number }>("/api/wallet/claim", { token });
    return balance;
  } catch (error) {
    // Already paid still means paid: the balance travels with the refusal, and there is nothing to retry.
    if (error instanceof WalletError && error.code === "already_paid") return error.balance;
    if (error instanceof WalletError && error.code === "not_found_yet") return null;
    throw error;
  }
}

export class WalletError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly balance: number | null = null,
  ) {
    super(message);
    this.name = "WalletError";
  }
}

async function call<T>(path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {};
  const initData = telegram()?.initData;
  if (initData !== undefined && initData !== "") headers["X-Telegram-Init-Data"] = initData;
  else headers["X-Wallet"] = await owner();
  if (body !== undefined) headers["content-type"] = "application/json";

  const response = await fetch(path, {
    method: body === undefined ? "GET" : "POST",
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload: unknown = await response.json().catch(() => ({}));
  if (!response.ok) {
    const { error, message, balance } = payload as { error?: string; message?: string; balance?: number };
    throw new WalletError(error ?? "unknown", message ?? `HTTP ${String(response.status)}`, balance ?? null);
  }
  return payload as T;
}

/** This browser's wallet token, asked of the Worker once and kept from then on. */
async function owner(): Promise<string> {
  const kept = read();
  if (kept !== null) return kept;
  const response = await fetch("/api/wallet", { method: "POST" });
  if (!response.ok) throw new WalletError("no_wallet", "could not open a wallet");
  const { owner: fresh } = (await response.json()) as { owner: string };
  try {
    localStorage.setItem(OWNER_KEY, fresh);
  } catch {
    // Private mode: the wallet lives until the tab closes, and what it buys goes with it.
  }
  return fresh;
}

function read(): string | null {
  try {
    return localStorage.getItem(OWNER_KEY);
  } catch {
    return null;
  }
}
