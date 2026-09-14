/**
 * Paying through TON Connect. Two shapes of one payment: the network's own coin carries the offer token as a plain
 * text comment, a jetton carries it in the forward payload of a TEP-74 transfer sent to the buyer's own jetton
 * wallet — never to the master and never straight to us. Either way the token is what brings the payment back to
 * its offer, so a message without it is money we cannot match. What happens after: docs/wallet.md
 */
import { beginCell, Address, toNano, type Cell } from "@ton/core";
import { TonConnectUI } from "@tonconnect/ui";
import { jettonWalletFor, type ChainOffer } from "./wallet";

// The jetton wallet burns gas of its own; this rides along and the unspent part comes back to the sender.
const JETTON_GAS = toNano("0.05");
// Anything above zero makes the jetton wallet forward our comment on, which is the only reason the comment survives.
const FORWARD = toNano("0.01");
const TRANSFER_OP = 0x0f8a7ea5;
const VALID_FOR_S = 600;

let ui: TonConnectUI | null = null;

export function tonConnect(): TonConnectUI {
  ui ??= new TonConnectUI({ manifestUrl: `${location.origin}/tonconnect-manifest.json` });
  return ui;
}

/** Hands the offer to the buyer's wallet. Resolves once the wallet reports it signed; the chain is asked separately. */
export async function payWithWallet(offer: ChainOffer): Promise<void> {
  const connect = tonConnect();
  const from = connect.account?.address ?? (await connected(connect));
  const message = offer.master === null ? nativeMessage(offer) : await jettonMessage(offer, from);
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

function nativeMessage(offer: ChainOffer): { address: string; amount: string; payload: string } {
  return { address: offer.address, amount: offer.amount, payload: boc(comment(offer.comment)) };
}

async function jettonMessage(
  offer: ChainOffer,
  from: string,
): Promise<{ address: string; amount: string; payload: string }> {
  if (offer.master === null) throw new Error("a jetton offer with no master");
  const wallet = await jettonWalletFor(offer.coin, from);
  const body = beginCell()
    .storeUint(TRANSFER_OP, 32)
    .storeUint(0n, 64)
    .storeCoins(BigInt(offer.amount))
    .storeAddress(Address.parse(offer.address))
    // Whatever gas is left over goes back to the buyer rather than staying with the jetton wallet.
    .storeAddress(Address.parse(from))
    .storeBit(0)
    .storeCoins(FORWARD)
    .storeBit(1)
    .storeRef(comment(offer.comment))
    .endCell();
  return { address: wallet, amount: JETTON_GAS.toString(), payload: boc(body) };
}

/** A text comment cell: op zero and the text, which is what every wallet and explorer reads as "comment". */
function comment(text: string): Cell {
  return beginCell().storeUint(0, 32).storeStringTail(text).endCell();
}

function boc(cell: Cell): string {
  return cell.toBoc().toString("base64");
}
