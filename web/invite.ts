/**
 * The invite on this side. A code the visitor arrived with waits in this browser until they have opened a day,
 * because an invite pays for a reader who reads, not for a visit; then it is spent once and forgotten whatever the
 * Worker answers, so a code that cannot be paid for is not retried on every day for the rest of the session.
 * The mana goes to whoever sent the link, never to the newcomer, so nothing here is announced on screen.
 * What an invite pays and what stops it being farmed: docs/wallet.md
 */
import { refreshPaid } from "./paid-mana";
import { inviteCode, redeemInvite } from "./wallet";

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

/** Pays the sender once this browser has opened a day. Silent either way: it is not this reader's mana. */
export async function settleInvite(): Promise<void> {
  const code = pending();
  if (code === null) return;
  forget();
  try {
    await redeemInvite(code);
  } catch {
    // Already counted, unknown, or the sender is full for today: either way there is nothing to say or retry.
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
