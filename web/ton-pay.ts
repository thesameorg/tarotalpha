/**
 * Paying through TON Connect. Two shapes of one payment: the network's own coin carries the offer token as a plain
 * text comment, a jetton carries it in the forward payload of a TEP-74 transfer sent to the buyer's own jetton
 * wallet — never to the master and never straight to us. Either way the token is what brings the payment back to
 * its offer, so a message without it is money we cannot match. What happens after: docs/wallet.md
 */
import { TonConnectUI } from "@tonconnect/ui";
import { jettonWalletFor, type ChainOffer } from "./wallet";

// Gas for the jetton wallet's own execution; whatever it does not burn comes back to the sender.
const JETTON_GAS = "50000000";
// Above zero so the jetton wallet forwards our comment on, which is the only reason the comment survives at all.
const FORWARD = "10000000";
const TRANSFER_OP = 0x0f8a7ea5;
const VALID_FOR_S = 600;

interface Message {
  address: string;
  amount: string;
  payload: string;
}

let ui: TonConnectUI | null = null;

export function tonConnect(): TonConnectUI {
  ui ??= new TonConnectUI({ manifestUrl: `${location.origin}/tonconnect-manifest.json` });
  return ui;
}

/** Hands the offer to the buyer's wallet. Resolves once the wallet reports it signed; the chain is asked separately. */
export async function payWithWallet(offer: ChainOffer): Promise<void> {
  const connect = tonConnect();
  const from = connect.account?.address ?? (await connected(connect));
  const message = offer.master === null ? await nativeMessage(offer) : await jettonMessage(offer, from);
  await connect.sendTransaction({
    validUntil: Math.floor(Date.now() / 1000) + VALID_FOR_S,
    messages: [message],
  });
}

/** Opens the wallet list and waits for a choice; the address is what a jetton transfer needs to be built at all. */
async function connected(connect: TonConnectUI): Promise<string> {
  await connect.openModal();
  const account = connect.account;
  if (account === null) throw new Error("no wallet connected");
  return account.address;
}

/** The cell builder, fetched rather than imported: `@ton/core` reads Node's Buffer while it is still evaluating,
 * and a static import runs before any line here, so the polyfill would arrive after the throw. */
async function cells(): Promise<typeof import("@ton/core")> {
  const { Buffer } = await import("buffer");
  // Typed loose on purpose: the type checker is told Node's Buffer exists, and the browser is the one that disagrees.
  const scope = globalThis as { Buffer?: unknown };
  scope.Buffer ??= Buffer;
  return await import("@ton/core");
}

async function nativeMessage(offer: ChainOffer): Promise<Message> {
  const { beginCell } = await cells();
  return { address: offer.address, amount: offer.amount, payload: boc(comment(beginCell, offer.comment)) };
}

async function jettonMessage(offer: ChainOffer, from: string): Promise<Message> {
  if (offer.master === null) throw new Error("a jetton offer with no master");
  const wallet = await jettonWalletFor(offer.coin, from);
  const { beginCell, Address } = await cells();
  const body = beginCell()
    .storeUint(TRANSFER_OP, 32)
    .storeUint(0n, 64)
    .storeCoins(BigInt(offer.amount))
    .storeAddress(Address.parse(offer.address))
    // Whatever gas is left over goes back to the buyer rather than staying with the jetton wallet.
    .storeAddress(Address.parse(from))
    .storeBit(0)
    .storeCoins(BigInt(FORWARD))
    .storeBit(1)
    .storeRef(comment(beginCell, offer.comment))
    .endCell();
  return { address: wallet, amount: JETTON_GAS, payload: boc(body) };
}

type Cell = ReturnType<ReturnType<typeof import("@ton/core").beginCell>["endCell"]>;

/** A text comment cell: op zero and the text, which is what every wallet and explorer reads as "comment". */
function comment(beginCell: typeof import("@ton/core").beginCell, text: string): Cell {
  return beginCell().storeUint(0, 32).storeStringTail(text).endCell();
}

function boc(cell: Cell): string {
  return cell.toBoc().toString("base64");
}
