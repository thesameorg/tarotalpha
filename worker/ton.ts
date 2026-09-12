/**
 * Reading the chain through tonapi. The Worker never signs and never sends: the buyer's wallet does that, and this
 * side only looks for the transfer carrying an offer's token as its comment. Rates are not asked for — tonapi
 * documents them as display-only, and packs are priced in nanotons directly (`worker/packs.ts`).
 * What the rail promises end to end: docs/wallet.md
 */
import { Api, HttpClient } from "tonapi-sdk-js";

/** How many recent events to look through: a busy hour of a joke site is nowhere near this. */
const EVENT_LIMIT = 100;

export interface FoundTransfer {
  /** What actually arrived, in nanotons. */
  nano: number;
  /** tonapi's event id; the invoice stores it, so one transfer can never pay two offers. */
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

/** Toncoin on the wallet right now, in nanotons. Only a smoke test that the address and the key work. */
export async function walletBalance(api: TonApi, wallet: string): Promise<number> {
  const account = await api.accounts.getAccount(wallet);
  return account.balance;
}

/** The finished incoming transfer commented `comment`, or null while tonapi has not indexed it. A settling event is
 * skipped: it can still fail, and crediting it would hand out mana for nothing. */
export async function findTransfer(api: TonApi, wallet: string, comment: string): Promise<FoundTransfer | null> {
  // tonapi answers in raw form whatever form it was asked in, so our own address is read back before comparing.
  const { address: ours } = await api.accounts.getAccount(wallet);
  const { events } = await api.accounts.getAccountEvents(wallet, { limit: EVENT_LIMIT });
  for (const event of events) {
    if (event.in_progress) continue;
    for (const action of event.actions) {
      if (action.type !== "TonTransfer" || action.status !== "ok") continue;
      const transfer = action.TonTransfer;
      if (transfer === undefined || transfer.comment !== comment) continue;
      // Our own outgoing transfers carry comments too; only what landed on us counts.
      if (transfer.recipient.address !== ours) continue;
      return { nano: transfer.amount, hash: event.event_id };
    }
  }
  return null;
}
