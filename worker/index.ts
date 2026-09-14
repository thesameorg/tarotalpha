/**
 * One Worker: `/api/*` is answered here, `/r/<id>` is index.html with the reading's meta tags, the rest is static.
 * The cron is the only writer that no request asks for: it scores readings whose horizon has closed.
 */
import { postEvent } from "./events";
import { beat } from "./heartbeat";
import { ApiError } from "./json-api";
import { rateLimited } from "./rate-limit";
import { readReaderRatings } from "./reader-ratings";
import { readingPage } from "./reading-page";
import { createReading, extendReading, readReading } from "./readings";
import { sweepMatured } from "./scoring";
import {
  claimInvoice,
  createInvoice,
  newWallet,
  readJettonWallet,
  readWallet,
  registerWebhook,
  spendMana,
  telegramWebhook,
} from "./wallet";

const READING_PAGE = /^\/r\/([^/]+)$/;
const READING_API = /^\/api\/readings\/([^/]+)$/;

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    // Telegram's webhook skips the limiter: it comes from Telegram's own addresses, and a `successful_payment`
    // dropped as "too many requests" is money taken with no mana behind it.
    if (pathname === "/api/tg/webhook" && request.method === "POST")
      return guarded(() => telegramWebhook(request, env));
    if (pathname.startsWith("/api/")) return api(pathname, request, env);
    const page = READING_PAGE.exec(pathname);
    if (page?.[1] !== undefined) return readingPage(page[1], request, env);
    return env.ASSETS.fetch(request);
  },
  async scheduled(_controller, env) {
    // Scoring first: an exchange that refuses a fresh snapshot must not cost the verdicts already waiting.
    // Each half fails on its own, so a D1 error in the sweep does not cost the track its draw either.
    const sweep = await sweepMatured(env, Date.now()).catch((error: unknown) => {
      console.error(error);
      return { scored: 0, parked: 0 };
    });
    const drawn = await beat(env, Date.now()).catch((error: unknown) => {
      console.error(error);
      return [];
    });
    console.log(`sweep: scored ${String(sweep.scored)}, parked ${String(sweep.parked)}, drew ${String(drawn.length)}`);
  },
} satisfies ExportedHandler<Env>;

async function api(pathname: string, request: Request, env: Env): Promise<Response> {
  const limited = await rateLimited(env.RATE_LIMITER, request);
  if (limited !== null) return limited;
  return await guarded(() => route(pathname, request, env));
}

async function guarded(handler: () => Promise<Response> | Response): Promise<Response> {
  try {
    return await handler();
  } catch (error) {
    if (error instanceof ApiError) return error.response();
    console.error(error);
    return Response.json({ error: "internal", message: "unexpected server error" }, { status: 500 });
  }
}

function route(pathname: string, request: Request, env: Env): Promise<Response> | Response {
  const { method } = request;
  if (pathname === "/api/health" && method === "GET") return Response.json({ ok: true });
  if (pathname === "/api/readings" && method === "POST") return createReading(request, env);
  if (pathname === "/api/readers" && method === "GET") return readReaderRatings(env);
  const reading = READING_API.exec(pathname);
  if (reading?.[1] !== undefined && method === "GET") return readReading(reading[1], env);
  if (reading?.[1] !== undefined && method === "PATCH") return extendReading(reading[1], request, env);
  if (pathname === "/api/omen" && method === "POST") return postEvent(request, env);
  if (pathname === "/api/wallet" && method === "POST") return newWallet();
  if (pathname === "/api/wallet" && method === "GET") return readWallet(request, env);
  if (pathname === "/api/wallet/invoice" && method === "POST") return createInvoice(request, env);
  if (pathname === "/api/wallet/claim" && method === "POST") return claimInvoice(request, env);
  if (pathname === "/api/wallet/jetton" && method === "POST") return readJettonWallet(request, env);
  if (pathname === "/api/wallet/spend" && method === "POST") return spendMana(request, env);
  if (pathname === "/api/tg/register" && method === "POST") return registerWebhook(request, env);
  throw new ApiError(404, "not_found", `no route ${method} ${pathname}`);
}
