/**
 * Second opinions on the reading open right now: which readers have been asked besides its author, and what asking
 * one more costs. The cards never change — every reader reads the same three (docs/engine.md) — only the formula
 * that turns them into candles does, so a second opinion is a second line on the same chart.
 * The flow that owns the reading registers how to consult; this module holds the list and the price.
 */
import type { ReaderId } from "../engine/readers";
import { payMana } from "./mana-purse";

/** What one more reader costs on one reading, asked once and good for every day of it, opened or still to come. */
export const OPINION_COST = 3;

/** Consults `id`, paying with `pay` at the last possible moment: everything that can refuse happens before the
 *  money moves, and once it has moved the reading keeps her whatever else changes on screen. */
type Asker = (id: ReaderId, pay: () => Promise<boolean>) => Promise<boolean>;

let asked: ReaderId[] = [];
let ask: Asker | null = null;
const listeners = new Set<() => void>();

/** The readers consulted on the open reading, in the order they were asked. */
export function opinions(): readonly ReaderId[] {
  return asked;
}

/** True once a reading is open and able to take a second opinion at all. */
export function opinionsOpen(): boolean {
  return ask !== null;
}

/** Whoever owns the reading says how a reader is consulted; passing null closes the reading to new opinions. */
export function setAsker(next: Asker | null, already: readonly ReaderId[] = []): void {
  ask = next;
  asked = [...already];
  announce();
}

/** Consults `id`, paying only once the reading is certain to take her on: mana that bought nothing cannot be
 * given back, so nothing that can refuse is left standing after the purse is touched. */
export async function askOpinion(id: ReaderId): Promise<boolean> {
  const consult = ask;
  if (consult === null || asked.includes(id)) return false;
  if (!(await consult(id, async () => payMana(OPINION_COST)))) return false;
  asked = [...asked, id];
  announce();
  return true;
}

export function onOpinionsChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function announce(): void {
  for (const listener of listeners) listener();
}
