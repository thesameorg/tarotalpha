/**
 * Client for the Worker API: which call happens when is in docs/reading-lifecycle.md.
 * A non-2xx answer becomes an ApiError with the status so the UI can pick a message; events are
 * fire-and-forget and never throw, because losing a funnel row must not break a reading.
 */
import type { StepCards } from "../engine/draw-cards";
import type { ReaderId } from "../engine/readers";
import type { Source } from "../exchange/provider";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export type SnapshotRow = readonly [t: number, o: number, h: number, l: number, c: number];

export interface ReadingRecord {
  id: string;
  asset: string;
  timeframe: string;
  anchor_ts: number;
  source: Source;
  engine_version: string;
  reader: ReaderId;
  /** The reading's own entropy; null in a row written before readings had any. */
  seed_nonce: string | null;
  created_at: string | number;
  steps: StepCards[];
  candles_snapshot: SnapshotRow[];
}

// `steps` is a count: the Worker draws the cards itself, from this nonce, and never trusts the client's cards.
export interface CreateReadingBody {
  asset: string;
  anchor_ts: number;
  steps: number;
  source: Source;
  reader: ReaderId;
  engine_version: string;
  seed_nonce: string;
}

/** The next open step of a stored reading; the Worker never lets a reading lose a day, so `steps` may come back larger. */
export interface ExtendReadingBody {
  steps: number;
  reader: ReaderId;
}

export interface CreatedReading {
  id: string;
  url: string;
  steps: number;
}

export interface ReaderStanding {
  reader: ReaderId;
  stars: number;
  /** Share of the scored readings where nobody at the table was closer to the market. */
  wins: number;
}

export interface ReaderTable {
  verdicts: number;
  readers: ReaderStanding[];
}

export type EventType =
  "chart_loaded" | "step_opened" | "paywall_hit" | "own_reading_clicked" | "replayed" | "shared" | "rechecked";

export interface FunnelEvent {
  type: EventType;
  asset?: string;
  reading_id?: string;
  step?: number;
}

async function requestJson(path: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(path, init);
  if (!response.ok) throw new ApiError(response.status, `${path}: HTTP ${String(response.status)}`);
  return response.json();
}

function sendJson(method: "POST" | "PATCH", path: string, body: unknown): Promise<unknown> {
  return requestJson(path, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function asCreated(value: unknown): CreatedReading {
  const created = value as Partial<CreatedReading>;
  if (typeof created.id !== "string" || typeof created.url !== "string" || typeof created.steps !== "number") {
    throw new ApiError(200, "readings: response without id, url and steps");
  }
  return { id: created.id, url: created.url, steps: created.steps };
}

export async function createReading(body: CreateReadingBody): Promise<CreatedReading> {
  return asCreated(await sendJson("POST", "/api/readings", body));
}

export async function extendReading(id: string, body: ExtendReadingBody): Promise<CreatedReading> {
  return asCreated(await sendJson("PATCH", `/api/readings/${encodeURIComponent(id)}`, body));
}

export async function fetchReading(id: string): Promise<ReadingRecord> {
  return (await requestJson(`/api/readings/${encodeURIComponent(id)}`)) as ReadingRecord;
}

export async function fetchReaderTable(): Promise<ReaderTable> {
  return (await requestJson("/api/readers")) as ReaderTable;
}

export function postEvent(event: FunnelEvent): void {
  fetch("/api/events", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(event),
    keepalive: true,
  }).catch(() => undefined);
}
