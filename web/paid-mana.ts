/**
 * Bought mana on the client: a number the Worker owns and this module only mirrors. It is read once at startup and
 * again after every purchase and every spend, because the browser is not allowed to decide what was paid for.
 * The two pools never merge — the free tank empties first and this one covers what it could not. Why the server
 * holds it and the free tank does not: docs/wallet.md
 */
import { spendPaid as spendOnServer, walletBalance } from "./wallet";

let balance = 0;
let known = false;
const listeners = new Set<() => void>();

/** What is left of the bought mana. Zero until the first read answers, which is also the honest starting guess. */
export function paidLeft(): number {
  return balance;
}

/** True once the Worker has answered at least once; until then the meter has nothing to show but zero. */
export function paidKnown(): boolean {
  return known;
}

export function onPaidChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Asks the Worker what the balance is now. Called at startup, after a purchase and after a spend. */
export async function refreshPaid(): Promise<number> {
  try {
    set(await walletBalance());
  } catch {
    // No wallet yet, or the network is out: the meter keeps the last number it knew rather than flashing zero.
  }
  return balance;
}

/** Spends `mana` of the bought pool. False, and nothing changes, when the Worker says there is not enough. */
export async function spendPaid(mana: number): Promise<boolean> {
  if (mana <= 0) return true;
  try {
    set(await spendOnServer(mana));
    return true;
  } catch {
    void refreshPaid();
    return false;
  }
}

function set(next: number): void {
  known = true;
  if (next === balance) return;
  balance = next;
  for (const listener of listeners) listener();
}
