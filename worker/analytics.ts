/**
 * Where a business fact lands: one Analytics Engine data point per event, read back by SQL over HTTP. Blob slots are
 * positional, so a slot never changes meaning and a new field is only ever appended — the three months of points
 * already written cannot be rewritten. The layout, the limits and the queries: docs/analytics.md.
 * The browser names what only it knows in one `X-Visit` header (web/visit.ts); the edge adds country, city and the
 * rest of `request.cf`. Nobody is named: the visitor is the browser's own random token, and neither the address nor
 * the user agent is written. A point holds twenty blobs at most, so a fact the Worker's own metrics already carry
 * does not get one.
 */
export type EventType =
  | "chart_loaded"
  | "step_opened"
  | "opinion_asked"
  | "paywall_hit"
  | "own_reading_clicked"
  | "replayed"
  | "shared"
  | "rechecked"
  | "scroll_opened"
  | "mana_panel_opened"
  | "paywall_shown"
  | "buy_clicked"
  | "share_failed"
  | "invoice_created"
  | "paid"
  | "invite_redeemed";

/** What an event carries besides the visit: where it happened, and what it cost. */
export interface EventPoint {
  type: EventType;
  asset?: string | null;
  readingId?: string | null;
  step?: number | null;
  /** Which flavour of this event: the rail that was paid, the pool whose panel opened, the pack that was clicked. */
  detail?: string | null;
  /** Mana this event drew down. */
  cost?: number | null;
  /** Money in cents, the same unit for stars and for TON: one column cannot hold two. */
  amount?: number | null;
}

const VISIT_HEADER = "X-Visit";
// Our own tokens are hex. The visitor rides in the index too, which Cloudflare caps in bytes rather than characters,
// so anything outside this alphabet is dropped whole: truncating it could fold one visitor onto another.
const ID = /^[A-Za-z0-9_-]{1,40}$/;
const FIELD_MAX = 64;
const SOURCE_MAX = 96;
const UNKNOWN = "unknown";

/** Never throws. A lost funnel row must not cost a reading, an offer or a payment that already went through. */
export function writeEvent(dataset: AnalyticsEngineDataset, request: Request, event: EventPoint): void {
  try {
    point(dataset, request, event);
  } catch (error: unknown) {
    console.error(error);
  }
}

function point(dataset: AnalyticsEngineDataset, request: Request, event: EventPoint): void {
  const visit = new URLSearchParams(request.headers.get(VISIT_HEADER) ?? "");
  // Only the edge ever calls the Worker, and there `cf` is the incoming request's own properties.
  const cf = request.cf as IncomingRequestCfProperties | undefined;
  const visitor = id(visit.get("v")) || UNKNOWN;
  dataset.writeDataPoint({
    // The sampling key. If a viral day ever trips it, whole visitors drop out and every share stays honest.
    indexes: [visitor],
    blobs: [
      event.type,
      visitor,
      id(visit.get("s")),
      text(visit.get("p")),
      text(visit.get("tp")),
      text(visit.get("d")),
      text(visit.get("os")),
      text(visit.get("l")),
      text(visit.get("th")),
      text(cf?.country),
      text(cf?.city),
      text(cf?.timezone),
      text(cf?.asOrganization),
      text(visit.get("src"), SOURCE_MAX),
      text(event.asset),
      text(event.readingId),
      text(event.detail),
    ],
    doubles: [
      number(event.step),
      hour(visit.get("h")),
      cf?.isEUCountry === "1" ? 1 : 0,
      number(cf?.clientTcpRtt),
      number(event.cost),
      number(event.amount),
    ],
  });
}

// Everything from the client is a claim: control characters out and the length capped, so one caller can neither
// break a query nor blow the 16 KB a point is allowed.
function text(value: string | null | undefined, max = FIELD_MAX): string {
  if (value === null || value === undefined) return "";
  return value.replace(/\p{C}/gu, "").slice(0, max);
}

function id(value: string | null): string {
  return value !== null && ID.test(value) ? value : "";
}

/** `-1` where the fact is missing, so an average over the column never reads a gap as a zero. */
function number(value: number | null | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? value : -1;
}

function hour(value: string | null): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 && parsed <= 23 ? parsed : -1;
}
