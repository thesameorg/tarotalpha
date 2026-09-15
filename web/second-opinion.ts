/**
 * Second opinions: which readers have been asked on a reading besides its author, what asking one more costs, and
 * how a stored one is read back. The cards never change — every reader reads the same three (docs/engine.md) — only
 * the formula that turns them into candles does, so a second opinion is a second line on the same chart.
 * The flow that owns the open reading registers how to consult; this module holds the list, the price and the replay.
 */
import { forecastFromCards, type Candle, type StepResult } from "../engine/index";
import { isReaderId, type ReaderId } from "../engine/readers";
import type { ReadingRecord } from "./api";
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

/** Every reader a stored reading says was asked, read over its own cards; one the engine no longer knows is skipped,
 *  because a reader is a formula and a formula can leave while the row that names her stays. */
export function opinionLines(record: ReadingRecord, snapshot: readonly Candle[]): Map<ReaderId, StepResult[]> {
  const steps = new Map<ReaderId, StepResult[]>();
  for (const id of record.opinions) {
    if (id === record.reader || !isReaderId(id)) continue;
    steps.set(
      id,
      forecastFromCards({
        asset: record.asset,
        anchorTs: record.anchor_ts,
        snapshot,
        reader: id,
        nonce: record.seed_nonce,
        cards: record.steps,
      }),
    );
  }
  return steps;
}

/** The days of each reader flattened into one line of candles: what the chart and the row of readers take. */
export function candlesByReader(steps: ReadonlyMap<ReaderId, readonly StepResult[]>): Map<ReaderId, Candle[]> {
  return new Map([...steps].map(([id, days]) => [id, days.flatMap((day) => day.candles)]));
}
