/**
 * Where a business fact lands: one Analytics Engine data point per event, read back by SQL over HTTP. Blob slots are
 * positional, so a slot never changes meaning and a new field is only ever appended — the three months of points
 * already written cannot be rewritten. The layout, the limits and the queries: docs/analytics.md.
 * The browser names what only it knows in one `X-Visit` header (web/visit.ts); the edge adds country, city and the
 * rest of `request.cf`. Nobody is named: the visitor is the browser's own random token, and neither the address nor
 * the user agent is written.
 */
export type EventType =
  | "chart_loaded"
  | "step_opened"
  | "paywall_hit"
  | "own_reading_clicked"
  | "replayed"
  | "shared"
  | "rechecked"
  | "scroll_opened"
  | "share_failed";

/** What an event carries besides the visit: the reading it happened on, and how far into it. */
export interface EventPoint {
  type: EventType;
  asset?: string | null;
  readingId?: string | null;
  step?: number | null;
}

const VISIT_HEADER = "X-Visit";
const FIELD_MAX = 64;
const SOURCE_MAX = 96;
const UNKNOWN = "unknown";

export function writeEvent(dataset: AnalyticsEngineDataset, request: Request, event: EventPoint): void {
  const visit = new URLSearchParams(request.headers.get(VISIT_HEADER) ?? "");
  // Only the edge ever calls the Worker, and there `cf` is the incoming request's own properties.
  const cf = request.cf as IncomingRequestCfProperties | undefined;
  const visitor = text(visit.get("v")) || UNKNOWN;
  dataset.writeDataPoint({
    // The sampling key. If a viral day ever trips it, whole visitors drop out and every share stays honest.
    indexes: [visitor],
    blobs: [
      event.type,
      visitor,
      text(visit.get("s")),
      text(visit.get("p")),
      text(visit.get("tp")),
      text(visit.get("d")),
      text(visit.get("os")),
      text(visit.get("l")),
      text(visit.get("th")),
      text(cf?.country),
      text(cf?.city),
      text(cf?.timezone),
      text(cf?.colo),
      text(cf?.asOrganization),
      text(cf?.httpProtocol),
      text(visit.get("src"), SOURCE_MAX),
      text(event.asset),
      text(event.readingId),
    ],
    doubles: [number(event.step), hour(visit.get("h")), cf?.isEUCountry === "1" ? 1 : 0, number(cf?.clientTcpRtt)],
  });
}

// Everything from the client is a claim: control characters out and the length capped, so one caller can neither
// break a query nor blow the 16 KB a point is allowed.
function text(value: string | null | undefined, max = FIELD_MAX): string {
  if (value === null || value === undefined) return "";
  return value.replace(/\p{C}/gu, "").slice(0, max);
}

/** `-1` where the fact is missing, so an average over the column never reads a gap as a zero. */
function number(value: number | null | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? value : -1;
}

function hour(value: string | null): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 && parsed <= 23 ? parsed : -1;
}
