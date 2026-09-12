/**
 * Mana: what opening a day of a reading costs. The tank refills a point an hour and in full at the viewer's local
 * midnight; it lives in this browser's localStorage and nothing on the server checks it, so a cleared storage is a
 * full tank. Every number to tune sits at the top. Why no server side: docs/reading-lifecycle.md
 */
import { HOUR_MS } from "../exchange/closed-candles";

export const MANA_CAPACITY = 10;
const REFILL_PER_HOUR = 1;
// Day n of a reading costs DAY_COST[n - 1]: the further ahead, the harder the future is to see. One per MAX_STEPS.
export const DAY_COST: readonly number[] = [1, 1, 1, 2, 2, 2, 3];
/** What the purchase dialog offers; nothing is billed yet. */
export const MANA_PACKS: readonly number[] = [10, 20, 30];

const STORAGE_KEY = "ta.mana";

/** `at` is when the refill clock last ticked; a full tank keeps it at the last look, so the clock starts on a spend. */
export interface Tank {
  mana: number;
  at: number;
}

/** What opening `day` costs when the first `paid` days of the same reading were already paid for here. */
export function dayCost(day: number, paid = 0): number {
  const cost = DAY_COST[day - 1];
  if (cost === undefined) throw new RangeError(`day ${String(day)} is past the horizon`);
  return day <= paid ? 0 : cost;
}

const sameLocalDay = (a: number, b: number): boolean => new Date(a).toDateString() === new Date(b).toDateString();

/** The tank as it stands at `now`: whole hours since the last tick refill, a new local day refills to the brim. */
export function settle(tank: Tank, now: number): Tank {
  if (!sameLocalDay(tank.at, now)) return { mana: Math.max(tank.mana, MANA_CAPACITY), at: now };
  if (tank.mana >= MANA_CAPACITY) return { mana: tank.mana, at: now };
  const hours = Math.floor((now - tank.at) / HOUR_MS);
  if (hours <= 0) return tank;
  const mana = Math.min(MANA_CAPACITY, tank.mana + hours * REFILL_PER_HOUR);
  return { mana, at: mana === MANA_CAPACITY ? now : tank.at + hours * HOUR_MS };
}

/** The tank after paying `cost` at `now`, or null when there is not enough. */
export function spend(tank: Tank, cost: number, now: number): Tank | null {
  const settled = settle(tank, now);
  return settled.mana < cost ? null : { mana: settled.mana - cost, at: settled.at };
}

/** What the storage holds, or a full tank when it holds nothing readable. */
export function parseTank(raw: string | null, now: number): Tank {
  try {
    const { mana, at } = JSON.parse(raw ?? "") as Record<string, unknown>;
    if (typeof mana === "number" && typeof at === "number" && mana >= 0) return { mana, at };
  } catch {
    // Nothing stored yet, or something else under the key: start full.
  }
  return { mana: MANA_CAPACITY, at: now };
}

const listeners = new Set<() => void>();
let tank: Tank | null = null;

/** Mana left right now. */
export function manaLeft(now = Date.now()): number {
  return current(now).mana;
}

/** Pays for a day; false, and nothing changes, when the tank is short. */
export function spendMana(cost: number, now = Date.now()): boolean {
  const next = spend(current(now), cost, now);
  if (next === null) return false;
  save(next);
  return true;
}

export function onManaChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function current(now: number): Tank {
  const before = tank ?? parseTank(read(), now);
  const after = settle(before, now);
  if (tank === null || after.mana !== before.mana) save(after);
  return after;
}

function save(next: Tank): void {
  const changed = tank?.mana !== next.mana;
  tank = next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Private mode or a full quota: the tank lives until the tab closes.
  }
  if (changed) for (const listener of listeners) listener();
}

function read(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}
