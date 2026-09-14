/**
 * The invite on this side. A code the visitor arrived with waits in this browser until they have opened a day,
 * because an invite pays for a reader who reads, not for a visit; then it is spent once and forgotten whatever the
 * Worker answers, so a code that cannot be paid for is not retried on every day for the rest of the session.
 * The mana goes to whoever sent the link, never to the newcomer, so nothing here is announced on screen.
 * What an invite pays and what stops it being farmed: docs/wallet.md
 */
import { t } from "./i18n/index";
import { refreshPaid } from "./paid-mana";
import { toast } from "./toast";
import { inviteCode, redeemInvite, WalletError } from "./wallet";

const PENDING_KEY = "ta.invite";
const CODE = /^[0-9a-f]{16}$/;

/** Remembers the code this visitor arrived with. A malformed one is ignored; a second one does not overwrite. */
export function arrivedBy(code: string | null): void {
  if (code === null || !CODE.test(code) || pending() !== null) return;
  try {
    localStorage.setItem(PENDING_KEY, code);
  } catch {
    // Private mode: the invite lives until the tab closes, and whoever sent it goes unpaid.
  }
}

/** Pays both sides once this browser has opened a day, naming the reading that day wrote: the Worker cannot see
 * mana, so the row is the only proof the newcomer reached the cards. A refusal is final and the code is dropped;
 * a network that blinked is not, and the invite waits for the next day. */
export async function settleInvite(reading: string): Promise<void> {
  const code = pending();
  if (code === null) return;
  try {
    const mana = await redeemInvite(code, reading);
    forget();
    // Half the gift is this reader's own, and a gold flask that jumps from nothing without a word is a puzzle.
    toast(t().paid.welcomed(mana));
    void refreshPaid();
  } catch (error: unknown) {
    if (error instanceof WalletError) forget();
  }
}

/** The link this purse hands out. The code names the sender and is not their purse token, which is a bearer. */
export async function myInviteLink(): Promise<{ url: string; code: string }> {
  const code = await inviteCode();
  const url = new URL(window.location.origin);
  url.searchParams.set("ref", code);
  // The gold flask reads the server, and an invite that landed while the panel was open should show up in it.
  void refreshPaid();
  return { url: url.href, code };
}

function pending(): string | null {
  try {
    const kept = localStorage.getItem(PENDING_KEY);
    return kept !== null && CODE.test(kept) ? kept : null;
  } catch {
    return null;
  }
}

function forget(): void {
  try {
    localStorage.removeItem(PENDING_KEY);
  } catch {
    // Nothing to forget: the code was never stored either.
  }
}
