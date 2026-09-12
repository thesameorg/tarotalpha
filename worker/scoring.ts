/**
 * The sweep that scores the score's own readings once their horizon has closed. One reading judges the whole table:
 * the cards are common ground, so five forecasts are rebuilt from what the row already holds and measured against
 * one set of real candles — the same market, the same cards, the same unit. Shared readings are never scored, and
 * no view triggers or changes any of this. When it runs and what it writes: ../docs/reading-lifecycle.md
 */
import {
  atr,
  CANDLES_PER_STEP,
  deviation,
  forecastFromCards,
  READER_IDS,
  type Candle,
  type Drifts,
  type StepCards,
} from "../engine/index";
import { fetchAfter, HOUR_MS } from "../exchange/closed-candles";
import type { Source } from "../exchange/provider";

// A cron on the free plan gets the same 10 ms of CPU as a request, and one reading costs about a millisecond to
// score for the whole table; five leaves room for the JSON and the batch. Runs are cheap, a killed run is not.
const SWEEP = 5;
// Three refusals and the reading is parked: a delisted symbol must not hold the head of the queue forever.
const ATTEMPTS = 3;

/** The snapshot is stored a row per candle, not an object per candle: it is the widest column in the table. */
type SnapshotRow = [t: number, o: number, h: number, l: number, c: number];

interface MaturedRow {
  id: string;
  asset: string;
  anchor_ts: number;
  source: string;
  seed_nonce: string | null;
  steps: string;
  candles_snapshot: string;
}

export interface Sweep {
  scored: number;
  parked: number;
}

export async function sweepMatured(env: Env, nowMs: number): Promise<Sweep> {
  // Ripe once the last forecast candle has closed, an hour after it opens: the rule of ripensAt in web/my-readings.ts.
  // An hour earlier the exchange is one candle short, and the ticks of that hour would spend all three attempts.
  const { results } = await env.DB.prepare(
    "SELECT id, asset, anchor_ts, source, seed_nonce, steps, candles_snapshot FROM readings" +
      " WHERE origin = 'beat' AND scored_at IS NULL AND attempts < ?1" +
      " AND anchor_ts + (json_array_length(steps) * ?2 + 1) * ?3 <= ?4 ORDER BY anchor_ts LIMIT ?5",
  )
    .bind(ATTEMPTS, CANDLES_PER_STEP, HOUR_MS, nowMs, SWEEP)
    .all<MaturedRow>();
  const writes: D1PreparedStatement[] = [];
  const sweep: Sweep = { scored: 0, parked: 0 };
  for (const row of results) {
    // A row the engine cannot replay counts as a refusal: thrown, it would stall the whole queue behind it forever.
    const drifts = await driftsOf(row, nowMs).catch((error: unknown) => {
      console.error(`sweep: reading ${row.id} cannot be scored`, error);
      return null;
    });
    if (drifts === null) {
      sweep.parked++;
      writes.push(env.DB.prepare("UPDATE readings SET attempts = attempts + 1 WHERE id = ?1").bind(row.id));
      continue;
    }
    sweep.scored++;
    writes.push(
      env.DB.prepare("UPDATE readings SET scores = ?1, scored_at = ?2 WHERE id = ?3 AND scored_at IS NULL").bind(
        JSON.stringify(drifts),
        nowMs,
        row.id,
      ),
    );
  }
  if (writes.length > 0) await env.DB.batch(writes);
  return sweep;
}

/** `null` when the exchange did not give the whole horizon: a verdict on half of it would freeze forever. */
async function driftsOf(row: MaturedRow, nowMs: number): Promise<Drifts | null> {
  const snapshot = (JSON.parse(row.candles_snapshot) as SnapshotRow[]).map(([t, o, h, l, c]) => ({ t, o, h, l, c }));
  const cards = JSON.parse(row.steps) as StepCards[];
  const horizon = cards.length * CANDLES_PER_STEP;
  const real = await realCandles(row, horizon, nowMs);
  if (real.length < horizon) return null;
  // ATR in price, as the link divides: NATR is a fraction of price and would scale every drift by the last close.
  const unit = atr(snapshot);
  const drifts: Drifts = {};
  for (const reader of READER_IDS) {
    const forecast = forecastFromCards({
      asset: row.asset,
      anchorTs: row.anchor_ts,
      snapshot,
      reader,
      nonce: row.seed_nonce,
      cards,
    }).flatMap((step) => step.candles);
    const { deviation: drift } = deviation(forecast, real, unit);
    if (drift === null) return null;
    drifts[reader] = drift;
  }
  return drifts;
}

async function realCandles(row: MaturedRow, horizon: number, nowMs: number): Promise<Candle[]> {
  try {
    return await fetchAfter(row.asset, row.anchor_ts, horizon, row.source as Source, nowMs);
  } catch {
    // An exchange that refused this minute may answer the next; the attempt counter decides when to give up.
    return [];
  }
}
