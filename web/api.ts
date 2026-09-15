/**
 * Client for the Worker API: which call happens when is in docs/reading-lifecycle.md.
 * A non-2xx answer becomes an ApiError with the status so the UI can pick a message; events are
 * fire-and-forget and never throw, because losing a funnel row must not break a reading.
 */
import type { StepCards } from "../engine/draw-cards";
import type { ReaderId } from "../engine/readers";
import type { Source } from "../exchange/provider";
import { visitHeader } from "./visit";

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
  reader: ReaderId;
  /** The reading's own entropy; null in a row written before readings had any. */
  seed_nonce: string | null;
  created_at: string | number;
  steps: StepCards[];
  candles_snapshot: SnapshotRow[];
  /** Readers asked about these same cards besides the author; empty in a row nobody paid a second opinion on. */
  opinions: ReaderId[];
}

// `steps` is a count: the Worker draws the cards itself, from this nonce. `cards` is only there to be matched
// against that draw, so a tab with an older bundle cannot store a reading its author never saw.
export interface CreateReadingBody {
  asset: string;
  anchor_ts: number;
  steps: number;
  source: Source;
  reader: ReaderId;
  seed_nonce: string;
  cards: StepCards[];
}

/** The next open step of a stored reading; the Worker never lets a reading lose a day, so `steps` may come back larger. */
export interface ExtendReadingBody {
  steps: number;
  reader: ReaderId;
  /** Every reader asked so far, not just the new one: the Worker only ever widens what the row already holds. */
  opinions?: readonly ReaderId[];
}

export interface CreatedReading {
  id: string;
  url: string;
  steps: number;
  opinions?: ReaderId[];
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
  | "chart_loaded"
  | "step_opened"
  | "paywall_hit"
  | "own_reading_clicked"
  | "replayed"
  | "shared"
  | "rechecked"
  | "scroll_opened";

export interface FunnelEvent {
  type: EventType;
  asset?: string;
  reading_id?: string;
  step?: number;
}

interface Call {
  method?: "POST" | "PATCH";
  headers?: Record<string, string>;
  body?: string;
}

// Who is looking rides on every call, so an event the Worker writes itself lands in the same visit (web/visit.ts).
// A browser that cannot tell (no storage, no crypto) is still served: the visit is simply unnamed.
function withVisit(headers: Record<string, string> = {}): Record<string, string> {
  try {
    const visit = visitHeader();
    return visit === "" ? headers : { ...headers, "X-Visit": visit };
  } catch {
    return headers;
  }
}

async function requestJson(path: string, call: Call = {}): Promise<unknown> {
  const response = await fetch(path, { ...call, headers: withVisit(call.headers) });
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
  fetch("/api/omen", {
    method: "POST",
    headers: withVisit({ "content-type": "application/json" }),
    body: JSON.stringify(event),
    keepalive: true,
  }).catch(() => undefined);
}
