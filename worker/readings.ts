/**
 * Writing, extending and reading a reading. The first open step writes the row, the next step extends it in place
 * from the stored snapshot, so the exchange is asked once per reading. The Worker never trusts the client's candles
 * or cards: it snapshots the candles itself, from the author's provider when the edge can reach it, and draws the
 * cards with its own engine, whose version label it stores next to them. What is stored and why:
 * docs/flows/reading-lifecycle.md
 */
import {
  computeSteps,
  ENGINE_VERSION,
  isReaderId,
  READER_IDS,
  type Candle,
  type ReaderId,
  type StepCards,
} from "../engine/index";
import {
  ASSET_PATTERN,
  fetchSnapshot,
  isHourAligned,
  lastClosedAnchor,
  SOURCES,
  type Snapshot,
} from "../exchange/closed-candles";
import { ExchangeError, type Source } from "../exchange/provider";
import { recordEvent } from "./events";
import { ApiError, readJsonBody } from "./json-api";
import { ID_PATTERN, shortId } from "./short-id";

export const FREE_STEPS = 2;
const ID_ATTEMPTS = 3;
const EXCHANGE_STATUS = { unknown_asset: 400, too_old: 422, unavailable: 502 } as const;

export interface CreateBody {
  asset: string;
  anchorTs: number;
  steps: number;
  source: Source;
  reader: ReaderId;
}

interface ReadingRow {
  id: string;
  asset: string;
  timeframe: string;
  anchor_ts: number;
  source: string;
  engine_version: string;
  reader: string;
  created_at: number;
  steps: string;
  candles_snapshot: string;
}

export interface ReadingMeta {
  asset: string;
  anchorTs: number;
  steps: number;
}

/** The snapshot is stored a row per candle, not an object per candle: it is the widest column in the table. */
type SnapshotRow = [t: number, o: number, h: number, l: number, c: number];

interface ExtendRow {
  asset: string;
  anchor_ts: number;
  seed_nonce: string | null;
  steps: string;
  candles_snapshot: string;
}

export async function createReading(request: Request, env: Env): Promise<Response> {
  const body = await parseCreateBody(request);
  // Nonce generation for SEED_ENTROPY=on is not built; refusing beats storing a reading that cannot be replayed.
  if (env.SEED_ENTROPY !== "off") {
    throw new ApiError(501, "not_implemented", "SEED_ENTROPY other than off is not supported yet");
  }
  const snapshot = await snapshotOrFail(body, request, env.DB);
  const steps = computeSteps({
    asset: body.asset,
    anchorTs: body.anchorTs,
    snapshot: snapshot.candles,
    reader: body.reader,
    steps: body.steps,
  }).map((result) => result.cards);
  const id = await insertReading(env.DB, body, steps, snapshot, "share");
  return Response.json({ id, url: `/r/${id}`, steps: body.steps }, { status: 201 });
}

/** The next open step: the cards are redrawn from the stored snapshot, so no exchange call and no new row. */
export async function extendReading(id: string, request: Request, env: Env): Promise<Response> {
  const { steps, reader } = await parseExtendBody(request);
  const row = ID_PATTERN.test(id)
    ? await env.DB.prepare(
        "SELECT asset, anchor_ts, seed_nonce, steps, candles_snapshot FROM readings WHERE id = ?1 AND origin = 'share'",
      )
        .bind(id)
        .first<ExtendRow>()
    : null;
  if (row === null) throw new ApiError(404, "not_found", `no reading ${id}`);
  // A reading never loses a day: a reopen of the same window that asks for fewer steps only moves the reader.
  const count = Math.max(steps, (JSON.parse(row.steps) as unknown[]).length);
  const snapshot: Candle[] = (JSON.parse(row.candles_snapshot) as SnapshotRow[]).map(([t, o, h, l, c]) => ({
    t,
    o,
    h,
    l,
    c,
  }));
  const cards = computeSteps({
    asset: row.asset,
    anchorTs: row.anchor_ts,
    snapshot,
    reader,
    nonce: row.seed_nonce,
    steps: count,
  }).map((result) => result.cards);
  await env.DB.prepare("UPDATE readings SET steps = ?2, reader = ?3, engine_version = ?4 WHERE id = ?1")
    .bind(id, JSON.stringify(cards), reader, ENGINE_VERSION)
    .run();
  return Response.json({ id, url: `/r/${id}`, steps: count });
}

export async function readReading(id: string, env: Env): Promise<Response> {
  const row = ID_PATTERN.test(id)
    ? await env.DB.prepare(
        "SELECT id, asset, timeframe, anchor_ts, source, engine_version, reader, created_at, steps, candles_snapshot" +
          " FROM readings WHERE id = ?1",
      )
        .bind(id)
        .first<ReadingRow>()
    : null;
  if (row === null) throw new ApiError(404, "not_found", `no reading ${id}`);
  // Reads write nothing: views are an analytics fact and live in Workers observability, not in D1.
  return Response.json({
    ...row,
    steps: JSON.parse(row.steps) as unknown,
    candles_snapshot: JSON.parse(row.candles_snapshot) as unknown,
  });
}

/** What the `/r/:id` meta tags need; `null` for an id that is malformed or unknown. */
export async function readingMeta(db: D1Database, id: string): Promise<ReadingMeta | null> {
  if (!ID_PATTERN.test(id)) return null;
  const row = await db
    .prepare("SELECT asset, anchor_ts, steps FROM readings WHERE id = ?1")
    .bind(id)
    .first<Pick<ReadingRow, "asset" | "anchor_ts" | "steps">>();
  if (row === null) return null;
  return { asset: row.asset, anchorTs: row.anchor_ts, steps: (JSON.parse(row.steps) as unknown[]).length };
}

async function parseCreateBody(request: Request): Promise<CreateBody> {
  const { asset, anchor_ts: anchorTs, steps, source, reader, engine_version: version } = await readJsonBody(request);
  if (typeof asset !== "string" || !ASSET_PATTERN.test(asset)) throw bad("asset must match ^[A-Z0-9]{2,20}$");
  if (typeof anchorTs !== "number" || !isHourAligned(anchorTs)) throw bad("anchor_ts must be an hour-aligned ms UTC");
  if (anchorTs > lastClosedAnchor(Date.now())) throw bad("anchor_ts must be an already closed candle");
  if (typeof steps !== "number" || !Number.isInteger(steps) || steps < 1) throw bad("steps must be an integer >= 1");
  if (steps > FREE_STEPS) {
    throw new ApiError(402, "paywall", `only ${String(FREE_STEPS)} steps are free`, { free_steps: FREE_STEPS });
  }
  if (!isSource(source)) throw bad(`source must be one of ${SOURCES.join(", ")}`);
  if (!isReaderId(reader)) throw bad(`reader must be one of ${READER_IDS.join(", ")}`);
  // A stale tab with an older bundle would have shown cards this engine no longer draws; refuse rather than mislabel.
  if (version !== ENGINE_VERSION) {
    throw new ApiError(409, "engine_mismatch", `server engine is ${ENGINE_VERSION}`, {
      engine_version: ENGINE_VERSION,
    });
  }
  return { asset, anchorTs, steps, source, reader };
}

async function parseExtendBody(request: Request): Promise<{ steps: number; reader: ReaderId }> {
  const { steps, reader } = await readJsonBody(request);
  if (typeof steps !== "number" || !Number.isInteger(steps) || steps < 1) throw bad("steps must be an integer >= 1");
  if (steps > FREE_STEPS) {
    throw new ApiError(402, "paywall", `only ${String(FREE_STEPS)} steps are free`, { free_steps: FREE_STEPS });
  }
  if (!isReaderId(reader)) throw bad(`reader must be one of ${READER_IDS.join(", ")}`);
  return { steps, reader };
}

async function snapshotOrFail(body: CreateBody, request: Request, db: D1Database): Promise<Snapshot> {
  try {
    // Author's provider first; Binance blocks the Cloudflare edge, so the next one beats no link at all.
    const order = [body.source, ...SOURCES.filter((source) => source !== body.source)];
    return await fetchSnapshot(body.asset, body.anchorTs, order);
  } catch (error) {
    if (!(error instanceof ExchangeError)) throw error;
    if (error.kind === "unavailable") {
      await recordEvent(db, request, { type: "share_failed", asset: body.asset, step: body.steps });
    }
    throw new ApiError(EXCHANGE_STATUS[error.kind], error.kind, error.message);
  }
}

/** Who drew it: `share` is a reading somebody opened and can send, `beat` is one the score drew for itself. */
export type ReadingOrigin = "share" | "beat";

/** The write itself, shared by the first open step and by the cron's own track. */
export async function insertReading(
  db: D1Database,
  body: CreateBody,
  steps: readonly StepCards[],
  snapshot: Snapshot,
  origin: ReadingOrigin,
): Promise<string> {
  const candles = JSON.stringify(snapshot.candles.map(({ t, o, h, l, c }) => [t, o, h, l, c]));
  const insert = db.prepare(
    "INSERT INTO readings (id, asset, anchor_ts, source, engine_version, reader, seed_nonce, steps," +
      " candles_snapshot, created_at, origin) VALUES (?1, ?2, ?3, ?4, ?5, ?6, NULL, ?7, ?8, ?9, ?10)",
  );
  for (let attempt = 1; ; attempt++) {
    const id = shortId();
    try {
      await insert
        .bind(
          id,
          body.asset,
          body.anchorTs,
          snapshot.source,
          ENGINE_VERSION,
          body.reader,
          JSON.stringify(steps),
          candles,
          Date.now(),
          origin,
        )
        .run();
      return id;
    } catch (error) {
      if (attempt >= ID_ATTEMPTS || !isIdCollision(error)) throw error;
    }
  }
}

function isIdCollision(error: unknown): boolean {
  return error instanceof Error && error.message.includes("UNIQUE constraint failed: readings.id");
}

function isSource(value: unknown): value is Source {
  return typeof value === "string" && (SOURCES as readonly string[]).includes(value);
}

function bad(message: string): ApiError {
  return new ApiError(400, "bad_request", message);
}
