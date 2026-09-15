/**
 * Funnel journal: the client reports what it did, the Worker turns it into one Analytics Engine point
 * (worker/analytics.ts). The one event only the Worker writes is a snapshot the edge could not take.
 * The route is `/api/omen` and stays that way: a path that reads like a tracker is filtered by ad blockers, and the
 * funnel then silently loses everyone who runs one (docs/reading-lifecycle.md).
 */
import { ASSET_PATTERN } from "../exchange/closed-candles";
import { type EventPoint, type EventType, writeEvent } from "./analytics";
import { ApiError, readJsonBody } from "./json-api";
import { packById } from "./packs";
import { ID_PATTERN } from "./short-id";

// What a browser is allowed to claim. `share_failed` is missing on purpose: only the Worker knows the exchange said no.
const CLIENT_TYPES = [
  "chart_loaded",
  "step_opened",
  "opinion_asked",
  "paywall_hit",
  "own_reading_clicked",
  "replayed",
  "shared",
  "rechecked",
  "scroll_opened",
  "mana_panel_opened",
  "paywall_shown",
  "buy_clicked",
  // Only the browser sees both rails land: a star payment reaches the Worker as Telegram's own request, which
  // carries neither the visit nor the buyer's country. What was really paid is in D1, not here.
  "paid",
] as const satisfies readonly EventType[];

// A flavour, not free text: it becomes a column people group by, and an open field there is unbounded cardinality.
const DETAIL = /^[A-Za-z0-9_-]{1,32}$/;
const COST_MAX = 1000;

type ClientEventType = (typeof CLIENT_TYPES)[number];

export async function postEvent(request: Request, env: Env): Promise<Response> {
  const event = await parseEventBody(request);
  writeEvent(env.ANALYTICS, request, priced(event));
  return new Response(null, { status: 204 });
}

// The browser names which lot was bought; what it costs is the shelf's number, not the buyer's. So a purchase
// arrives without a sum and leaves with one, and nobody can report revenue they did not pay.
function priced(event: EventPoint): EventPoint {
  if (event.type !== "paid") return event;
  const pack = packById(event.detail);
  return pack === null ? event : { ...event, amount: pack.cents };
}

async function parseEventBody(request: Request): Promise<EventPoint> {
  const { type, asset, reading_id: readingId, step, detail, cost } = await readJsonBody(request);
  if (!isClientType(type)) throw bad(`type must be one of ${CLIENT_TYPES.join(", ")}`);
  if (isPresent(asset) && !(typeof asset === "string" && ASSET_PATTERN.test(asset))) throw bad("asset is not a symbol");
  if (isPresent(readingId) && !(typeof readingId === "string" && ID_PATTERN.test(readingId))) {
    throw bad("reading_id is not a reading id");
  }
  if (isPresent(step) && !(typeof step === "number" && Number.isInteger(step) && step >= 1)) {
    throw bad("step must be a positive integer");
  }
  if (isPresent(detail) && !(typeof detail === "string" && DETAIL.test(detail))) throw bad("detail is not a slug");
  if (isPresent(cost) && !(typeof cost === "number" && Number.isInteger(cost) && cost >= 1 && cost <= COST_MAX)) {
    throw bad(`cost must be a whole number of mana up to ${String(COST_MAX)}`);
  }
  return {
    type,
    asset: asset as string | undefined,
    readingId: readingId as string | undefined,
    step: step as number | undefined,
    detail: detail as string | undefined,
    cost: cost as number | undefined,
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
