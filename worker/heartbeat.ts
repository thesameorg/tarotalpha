/**
 * The score's own readings. A rating built on whatever instruments people happen to draw would say more about the
 * week's popular coin than about the readers, so the score keeps its own track: one instrument, one reading every
 * four hours, drawn by the cron and by nobody else. A reading is a hypothesis by all five readers at once, so one
 * draw beats the whole table. While the track is short the cron fills it backwards, a few slots per run.
 * Why the track is one instrument: ../docs/reading-lifecycle.md
 */
import { computeSteps, DEFAULT_READER } from "../engine/index";
import { fetchSnapshot, lastClosedAnchor } from "../exchange/closed-candles";
import { insertReading } from "./readings";
import { shortId } from "./short-id";

export const BENCHMARK = "BTCUSDT";
const SLOT_MS = 4 * 3_600_000;
const STEPS = 2;
// Ten days of slots: far past the memory of the fold, and near enough that any exchange still has the candles.
const TRACK = 60;
// A draw costs one exchange call and shares the run's ten milliseconds with the sweep, so the track fills in hours.
const PER_RUN = 3;

/** Anchors drawn on this run: the current slot first, then backwards into whatever the track is still missing. */
export async function beat(env: Env, nowMs: number): Promise<number[]> {
  const missing = (await missingSlots(env.DB, nowMs)).slice(0, PER_RUN);
  for (const anchorTs of missing) await draw(env.DB, anchorTs);
  return missing;
}

async function missingSlots(db: D1Database, nowMs: number): Promise<number[]> {
  const newest = Math.floor(lastClosedAnchor(nowMs) / SLOT_MS) * SLOT_MS;
  const oldest = newest - (TRACK - 1) * SLOT_MS;
  const { results } = await db
    .prepare("SELECT anchor_ts FROM readings WHERE origin = 'beat' AND anchor_ts >= ?1")
    .bind(oldest)
    .all<{ anchor_ts: number }>();
  const drawn = new Set(results.map((row) => row.anchor_ts));
  const missing: number[] = [];
  for (let slot = newest; slot >= oldest; slot -= SLOT_MS) if (!drawn.has(slot)) missing.push(slot);
  return missing;
}

async function draw(db: D1Database, anchorTs: number): Promise<string> {
  const snapshot = await fetchSnapshot(BENCHMARK, anchorTs);
  // Its own entropy, drawn like an id: a reading of the track is as unrepeatable as anybody's, and the row keeps it.
  const nonce = shortId();
  const cards = computeSteps({
    asset: BENCHMARK,
    anchorTs,
    snapshot: snapshot.candles,
    reader: DEFAULT_READER,
    nonce,
    steps: STEPS,
  }).map((step) => step.cards);
  const body = { asset: BENCHMARK, anchorTs, steps: STEPS, source: snapshot.source, reader: DEFAULT_READER, nonce };
  return insertReading(db, body, cards, snapshot, "beat");
}
