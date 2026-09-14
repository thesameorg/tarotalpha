/**
 * Reading the chain through tonapi. The Worker never signs and never sends: the buyer's wallet does that, and this
 * side only looks for the payment carrying an offer's token as its comment — a Gram transfer or a jetton transfer,
 * the same search either way. The rate is asked for once, when an offer is written, and never again: the offer keeps
 * both the price and the least we will settle for, so a claim is pure comparison. Rail end to end: docs/wallet.md
 */
import { Api, HttpClient } from "tonapi-sdk-js";
import type { Coin } from "./coins";

/** How many recent events to look through: a busy hour of a joke site is nowhere near this. */
const EVENT_LIMIT = 100;

export interface FoundPayment {
  /** What arrived, in the coin's own smallest unit. */
  units: bigint;
  /** tonapi's event id; the invoice stores it, so one payment can never settle two offers. */
  hash: string;
}

export type TonApi = Api<unknown>;

export function tonClient(apiKey: string): TonApi {
  return new Api(
    new HttpClient({
      baseUrl: "https://tonapi.io",
      baseApiParams: { headers: { Authorization: `Bearer ${apiKey}` } },
    }),
  );
}

/** Toncoin — Gram since June 2026 — on the wallet right now. Only a smoke test that the address and the key work. */
export async function walletBalance(api: TonApi, wallet: string): Promise<number> {
  const account = await api.accounts.getAccount(wallet);
  return account.balance;
}

/** Where this buyer's own jetton wallet lives; a jetton transfer is sent there, never to the master or to us. */
export async function jettonWalletOf(api: TonApi, owner: string, master: string): Promise<string | null> {
  try {
    const held = await api.accounts.getAccountJettonBalance(owner, master);
    return held.wallet_address.address;
  } catch {
    // Never held this jetton, so there is no wallet to send from and nothing to pay with.
    return null;
  }
}

/** What `cents` is worth in `coin`'s smallest unit. A coin pegged to the dollar needs no rate and gets none. */
export async function quote(api: TonApi, coin: Coin, cents: number): Promise<bigint> {
  const scale = 10n ** BigInt(coin.decimals);
  if (coin.rateToken === null) return (BigInt(cents) * scale) / 100n;
  const rates = await api.rates.getRates({ tokens: [coin.rateToken], currencies: ["usd"] });
  const usd = Object.values(rates.rates)[0]?.prices?.USD;
  if (typeof usd !== "number" || usd <= 0) throw new Error(`tonapi gave no usd rate for ${coin.rateToken}`);
  return BigInt(Math.round((cents / 100 / usd) * Number(scale)));
}

/** The finished incoming payment in `coin` commented `comment`, or null while tonapi has not indexed it. A settling
 * event is skipped: it can still fail, and crediting it would hand out mana for nothing. */
export async function findPayment(
  api: TonApi,
  wallet: string,
  comment: string,
  coin: Coin,
): Promise<FoundPayment | null> {
  // tonapi answers in raw form whatever form it was asked in, so our own address is read back before comparing.
  const { address: ours } = await api.accounts.getAccount(wallet);
  const { events } = await api.accounts.getAccountEvents(wallet, { limit: EVENT_LIMIT });
  for (const event of events) {
    if (event.in_progress) continue;
    for (const action of event.actions) {
      if (action.status !== "ok") continue;
      const units = unitsOf(action, comment, ours, coin);
      if (units !== null) return { units, hash: event.event_id };
    }
  }
  return null;
}

/** What this action paid us in `coin`, or null when it is not that payment at all. */
function unitsOf(action: Action, comment: string, ours: string, coin: Coin): bigint | null {
  if (coin.master === null) {
    const transfer = action.type === "TonTransfer" ? action.TonTransfer : undefined;
    // Our own outgoing transfers carry comments too; only what landed on us counts.
    if (transfer === undefined || transfer.comment !== comment) return null;
    return transfer.recipient.address === ours ? BigInt(transfer.amount) : null;
  }
  const transfer = action.type === "JettonTransfer" ? action.JettonTransfer : undefined;
  if (transfer === undefined || transfer.comment !== comment) return null;
  if (transfer.recipient?.address !== ours) return null;
  // The whole point of pinning the master: a forgery may call itself USD₮ and look right everywhere else.
  return transfer.jetton.address === coin.master ? BigInt(transfer.amount) : null;
}

type Action = Awaited<ReturnType<TonApi["accounts"]["getAccountEvents"]>>["events"][number]["actions"][number];
