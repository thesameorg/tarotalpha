/**
 * Funnel journal: one row per event, read only by the owner's own SQL. The client reports what it did; the one
 * event only the Worker writes is a snapshot the edge could not take.
 * `ip_hash` is a daily-rotating pseudonym (SHA-256 of address and date), not an identity.
 */
import { ASSET_PATTERN } from "../exchange/closed-candles";
import { ApiError, readJsonBody } from "./json-api";
import { clientIp } from "./rate-limit";
import { ID_PATTERN } from "./short-id";

const CLIENT_TYPES = [
  "chart_loaded",
  "step_opened",
  "paywall_hit",
  "own_reading_clicked",
  "replayed",
  "shared",
  "rechecked",
] as const;

type ClientEventType = (typeof CLIENT_TYPES)[number];
export type EventType = ClientEventType | "share_failed";

export interface EventInput {
  type: EventType;
  asset?: string | null;
  readingId?: string | null;
  step?: number | null;
}

export async function recordEvent(
  db: D1Database,
  request: Request,
  event: EventInput,
  now = Date.now(),
): Promise<void> {
  const hash = await ipHash(clientIp(request), now);
  await db
    .prepare("INSERT INTO events (ts, type, asset, reading_id, step, ip_hash) VALUES (?1, ?2, ?3, ?4, ?5, ?6)")
    .bind(now, event.type, event.asset ?? null, event.readingId ?? null, event.step ?? null, hash)
    .run();
}

export async function postEvent(request: Request, env: Env): Promise<Response> {
  const event = await parseEventBody(request);
  await recordEvent(env.DB, request, event);
  return new Response(null, { status: 204 });
}

async function ipHash(ip: string, now: number): Promise<string> {
  const day = new Date(now).toISOString().slice(0, 10);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${ip}:${day}`));
  return Array.from(new Uint8Array(digest, 0, 8), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function parseEventBody(request: Request): Promise<EventInput> {
  const { type, asset, reading_id: readingId, step } = await readJsonBody(request);
  if (!isClientType(type)) throw bad(`type must be one of ${CLIENT_TYPES.join(", ")}`);
  if (isPresent(asset) && !(typeof asset === "string" && ASSET_PATTERN.test(asset))) throw bad("asset is not a symbol");
  if (isPresent(readingId) && !(typeof readingId === "string" && ID_PATTERN.test(readingId))) {
    throw bad("reading_id is not a reading id");
  }
  if (isPresent(step) && !(typeof step === "number" && Number.isInteger(step) && step >= 1)) {
    throw bad("step must be a positive integer");
  }
  return {
    type,
    asset: asset as string | undefined,
    readingId: readingId as string | undefined,
    step: step as number | undefined,
  };
}

function isClientType(value: unknown): value is ClientEventType {
  return typeof value === "string" && (CLIENT_TYPES as readonly string[]).includes(value);
}

function isPresent(value: unknown): boolean {
  return value !== undefined && value !== null;
}

function bad(message: string): ApiError {
  return new ApiError(400, "bad_request", message);
}
