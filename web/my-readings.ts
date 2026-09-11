/**
 * My readings: the readings this browser opened, kept as ids next to what a list row needs, so the list draws
 * without a request. Outside Telegram the entries live in localStorage; inside, in the client's CloudStorage, which
 * follows the user across devices. The row in D1 is the source of truth: `/r/:id` reads it, the entry only points
 * at it. Why ids in the browser and not accounts: docs/reading-lifecycle.md
 */
import type { CloudStorage } from "@twa-dev/types";
import { CANDLES_PER_STEP } from "../engine/index";
import { isReaderId, type ReaderId } from "../engine/readers";
import { ASSET_PATTERN, HOUR_MS } from "../exchange/closed-candles";

export interface MyReading {
  id: string;
  asset: string;
  anchor_ts: number;
  steps: number;
  reader: ReaderId;
  created_at: number;
  /** When the viewer opened it from the list after it ripened; null until then. */
  checked_at: number | null;
}

/** One value per reading id; both storages speak this and the list never needs more. */
export interface ReadingStore {
  read(): Promise<string[]>;
  write(id: string, value: string): Promise<void>;
  remove(id: string): Promise<void>;
}

const LOCAL_PREFIX = "ta.reading.";
const CLOUD_PREFIX = "reading_";
// Well under CloudStorage's 1024 keys; the oldest entry goes when the list is full.
const KEEP = 200;
// A client that never answers must not hang the reading flow: the list is then empty and the write is lost.
const CLOUD_TIMEOUT_MS = 3000;
// The id goes into markup and into a path, so a stored entry is trusted no further than a launch parameter.
const READING_ID = /^[A-Za-z0-9_-]{1,32}$/;

const listeners = new Set<() => void>();
let store: ReadingStore | null = null;
let entries: MyReading[] = [];
let ready: Promise<void> = Promise.resolve();

export function initMyReadings(cloud: CloudStorage | null): void {
  const chosen = cloud === null ? localStore() : cloudStore(cloud);
  store = chosen;
  ready = chosen.read().then(
    (values) => {
      entries = sorted(values.flatMap(parse));
      notify();
    },
    () => undefined,
  );
}

/** The list once the storage has answered, newest first. */
export async function myReadings(): Promise<readonly MyReading[]> {
  await ready;
  return entries;
}

/** What the list holds right now, for a paint; `myReadings` waits for the storage. */
export function myReadingsNow(): readonly MyReading[] {
  return entries;
}

export function onMyReadingsChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** This reader's reading of this window, if this browser opened it before: the row is extended, not doubled. */
export async function findMyReading(asset: string, anchorTs: number, reader: ReaderId): Promise<MyReading | undefined> {
  await ready;
  return entries.find((entry) => entry.asset === asset && entry.anchor_ts === anchorTs && entry.reader === reader);
}

export async function rememberReading(
  next: Omit<MyReading, "created_at" | "checked_at">,
  now = Date.now(),
): Promise<void> {
  await ready;
  const known = entries.find((entry) => entry.id === next.id);
  const entry: MyReading = { ...next, created_at: known?.created_at ?? now, checked_at: known?.checked_at ?? null };
  entries = sorted([entry, ...entries.filter((other) => other.id !== next.id)]);
  const evicted = entries.splice(KEEP);
  notify();
  await persist(entry);
  for (const old of evicted) await store?.remove(old.id).catch(() => undefined);
}

export async function markChecked(id: string, now = Date.now()): Promise<void> {
  await ready;
  const known = entries.find((entry) => entry.id === id);
  if (known === undefined || known.checked_at !== null) return;
  const entry: MyReading = { ...known, checked_at: now };
  entries = entries.map((other) => (other.id === id ? entry : other));
  notify();
  await persist(entry);
}

/** When the last candle of the forecast closes: from then on the reading is ripe for the prophecy check. */
export function ripensAt(entry: Pick<MyReading, "anchor_ts" | "steps">): number {
  return entry.anchor_ts + (entry.steps * CANDLES_PER_STEP + 1) * HOUR_MS;
}

export function isRipe(entry: Pick<MyReading, "anchor_ts" | "steps">, now: number): boolean {
  return now >= ripensAt(entry);
}

export function hoursToRipe(entry: Pick<MyReading, "anchor_ts" | "steps">, now: number): number {
  return Math.max(1, Math.ceil((ripensAt(entry) - now) / HOUR_MS));
}

export function hasUnchecked(list: readonly MyReading[], now: number): boolean {
  return list.some((entry) => entry.checked_at === null && isRipe(entry, now));
}

export function localStore(): ReadingStore {
  return {
    read: () =>
      attempt(() =>
        Object.keys(localStorage)
          .filter((key) => key.startsWith(LOCAL_PREFIX))
          .map((key) => localStorage.getItem(key) ?? ""),
      ),
    write: (id, value) =>
      attempt(() => {
        localStorage.setItem(LOCAL_PREFIX + id, value);
      }),
    remove: (id) =>
      attempt(() => {
        localStorage.removeItem(LOCAL_PREFIX + id);
      }),
  };
}

export function cloudStore(cloud: CloudStorage): ReadingStore {
  return {
    read: async () => {
      const keys = (
        await call<string[]>((done) => {
          cloud.getKeys(done);
        })
      ).filter((key) => key.startsWith(CLOUD_PREFIX));
      if (keys.length === 0) return [];
      return Object.values(
        await call<Record<string, string>>((done) => {
          cloud.getItems(keys, done);
        }),
      );
    },
    write: (id, value) =>
      call<boolean>((done) => {
        cloud.setItem(CLOUD_PREFIX + id, value, done);
      }).then(() => undefined),
    remove: (id) =>
      call<boolean>((done) => {
        cloud.removeItem(CLOUD_PREFIX + id, done);
      }).then(() => undefined),
  };
}

// A storage that refuses (private mode, a full quota, a silent client) costs the entry, never the reading flow.
async function persist(entry: MyReading): Promise<void> {
  await store?.write(entry.id, JSON.stringify(entry)).catch(() => undefined);
}

type Done<T> = (error: string | null, result?: T) => void;

function call<T>(run: (done: Done<T>) => void): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error("CloudStorage did not answer"));
    }, CLOUD_TIMEOUT_MS);
    run((error, result) => {
      clearTimeout(timer);
      if (error !== null || result === undefined) reject(new Error(error ?? "CloudStorage answered nothing"));
      else resolve(result);
    });
  });
}

// A throw inside the executor becomes a rejection, so a blocked localStorage reads as a failed store, not a crash.
function attempt<T>(work: () => T): Promise<T> {
  return new Promise((resolve) => {
    resolve(work());
  });
}

function parse(value: string): MyReading[] {
  let raw: unknown;
  try {
    raw = JSON.parse(value);
  } catch {
    return [];
  }
  if (typeof raw !== "object" || raw === null) return [];
  const { id, asset, anchor_ts, steps, reader, created_at, checked_at } = raw as Record<string, unknown>;
  if (typeof id !== "string" || !READING_ID.test(id) || typeof asset !== "string" || !ASSET_PATTERN.test(asset))
    return [];
  if (!isReaderId(reader)) return [];
  if (typeof anchor_ts !== "number" || typeof steps !== "number" || typeof created_at !== "number") return [];
  return [
    { id, asset, anchor_ts, steps, reader, created_at, checked_at: typeof checked_at === "number" ? checked_at : null },
  ];
}

function sorted(list: readonly MyReading[]): MyReading[] {
  return [...list].sort((a, b) => b.created_at - a.created_at);
}

function notify(): void {
  for (const listener of listeners) listener();
}
