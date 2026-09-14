/**
 * One price against two pools. The free tank pays what it can and the bought purse covers the rest, and the server
 * is asked before anything is deducted, because only it can refuse; an endless purse covers everything without
 * being drawn down. Every action that costs mana goes through here, not just opening a day.
 * What the two pools are and why one of them is on the server: docs/wallet.md
 */
import { manaLeft, spendMana } from "./mana";
import { paidLeft, paidUnlimited, spendPaid } from "./paid-mana";

/** True when the two pools together cannot cover `cost`. An endless purse is never short. */
export function shortOf(cost: number): boolean {
  return !paidUnlimited() && manaLeft() + paidLeft() < cost;
}

/** Pays `cost`, or returns false having deducted nothing: the purse is asked first, the tank only after its yes. */
export async function payMana(cost: number): Promise<boolean> {
  const fromFree = Math.min(manaLeft(), cost);
  if (cost > fromFree && !(await spendPaid(cost - fromFree))) return false;
  spendMana(fromFree);
  return true;
}
