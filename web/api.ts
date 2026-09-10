/**
 * Client for the Worker API: which call happens when is in docs/flows/reading-lifecycle.md.
 * A non-2xx answer becomes an ApiError with the status so the UI can pick a message; events are
 * fire-and-forget and never throw, because losing a funnel row must not break a reading.
 */
import type { StepCards } from "../engine/v1/draw-cards";
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
  created_at: string | number;
  steps: StepCards[];
  candles_snapshot: SnapshotRow[];
}

// `steps` is a count: the Worker draws the cards itself with the same engine and never trusts the client's.
export interface CreateReadingBody {
  asset: string;
  anchor_ts: number;
  steps: number;
  source: Source;
  engine_version: string;
}

export interface CreatedReading {
  id: string;
  url: string;
}

export type EventType = "chart_loaded" | "step_opened" | "paywall_hit" | "own_reading_clicked" | "replayed";

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

function postJson(path: string, body: unknown): Promise<unknown> {
  return requestJson(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function fetchTodayCount(): Promise<number> {
  const body = (await requestJson("/api/stats/today")) as { steps_today?: unknown };
  if (typeof body.steps_today !== "number") throw new ApiError(200, "stats: no numeric steps_today");
  return body.steps_today;
}

export async function createReading(body: CreateReadingBody): Promise<CreatedReading> {
  const created = (await postJson("/api/readings", body)) as Partial<CreatedReading>;
  if (typeof created.id !== "string" || typeof created.url !== "string") {
    throw new ApiError(200, "readings: response without id and url");
  }
  return { id: created.id, url: created.url };
}

export async function fetchReading(id: string): Promise<ReadingRecord> {
  return (await requestJson(`/api/readings/${encodeURIComponent(id)}`)) as ReadingRecord;
}

export function postEvent(event: FunnelEvent): void {
  fetch("/api/events", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(event),
    keepalive: true,
  }).catch(() => undefined);
}
