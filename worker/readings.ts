/**
 * Writing and reading a reading. The Worker never trusts the client's candles or cards: it snapshots the candles
 * itself, from the author's provider when the edge can reach it, and draws the cards with its own engine, whose
 * version label it stores next to them. What is stored and why: docs/flows/reading-lifecycle.md
 */
import { computeSteps, ENGINE_VERSION, type StepCards } from "../engine/index";
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

interface CreateBody {
  asset: string;
  anchorTs: number;
  steps: number;
  source: Source;
}

interface ReadingRow {
  id: string;
  asset: string;
  timeframe: string;
  anchor_ts: number;
  source: string;
  engine_version: string;
  created_at: number;
  steps: string;
  candles_snapshot: string;
}

export interface ReadingMeta {
  asset: string;
  anchorTs: number;
  steps: number;
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
    steps: body.steps,
  }).map((result) => result.cards);
  const id = await insertReading(env.DB, body, steps, snapshot);
  await recordEvent(env.DB, request, { type: "shared", asset: body.asset, readingId: id, step: body.steps });
  return Response.json({ id, url: `/r/${id}` }, { status: 201 });
}

export async function readReading(id: string, env: Env): Promise<Response> {
  const row = ID_PATTERN.test(id)
    ? await env.DB.prepare(
        "SELECT id, asset, timeframe, anchor_ts, source, engine_version, created_at, steps, candles_snapshot" +
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
  const { asset, anchor_ts: anchorTs, steps, source, engine_version: version } = await readJsonBody(request);
  if (typeof asset !== "string" || !ASSET_PATTERN.test(asset)) throw bad("asset must match ^[A-Z0-9]{2,20}$");
  if (typeof anchorTs !== "number" || !isHourAligned(anchorTs)) throw bad("anchor_ts must be an hour-aligned ms UTC");
  if (anchorTs > lastClosedAnchor(Date.now())) throw bad("anchor_ts must be an already closed candle");
  if (typeof steps !== "number" || !Number.isInteger(steps) || steps < 1) throw bad("steps must be an integer >= 1");
  if (steps > FREE_STEPS) {
    throw new ApiError(402, "paywall", `only ${String(FREE_STEPS)} steps are free`, { free_steps: FREE_STEPS });
  }
  if (!isSource(source)) throw bad(`source must be one of ${SOURCES.join(", ")}`);
  // A stale tab with an older bundle would have shown cards this engine no longer draws; refuse rather than mislabel.
  if (version !== ENGINE_VERSION) {
    throw new ApiError(409, "engine_mismatch", `server engine is ${ENGINE_VERSION}`, {
      engine_version: ENGINE_VERSION,
    });
  }
  return { asset, anchorTs, steps, source };
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

async function insertReading(
  db: D1Database,
  body: CreateBody,
  steps: readonly StepCards[],
  snapshot: Snapshot,
): Promise<string> {
  const candles = JSON.stringify(snapshot.candles.map(({ t, o, h, l, c }) => [t, o, h, l, c]));
  const insert = db.prepare(
    "INSERT INTO readings (id, asset, anchor_ts, source, engine_version, seed_nonce, steps, candles_snapshot, created_at)" +
      " VALUES (?1, ?2, ?3, ?4, ?5, NULL, ?6, ?7, ?8)",
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
          JSON.stringify(steps),
          candles,
          Date.now(),
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
