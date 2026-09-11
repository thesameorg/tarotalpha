/**
 * One Worker: `/api/*` is answered here, `/r/<id>` is index.html with the reading's meta tags, the rest is static.
 * The cron is the only writer that no request asks for: it scores readings whose horizon has closed.
 */
import { ENGINE_VERSION } from "../engine/index";
import { postEvent } from "./events";
import { beat } from "./heartbeat";
import { ApiError } from "./json-api";
import { rateLimited } from "./rate-limit";
import { readReaderRatings } from "./reader-ratings";
import { readingPage } from "./reading-page";
import { createReading, extendReading, readReading } from "./readings";
import { sweepMatured } from "./scoring";

const READING_PAGE = /^\/r\/([^/]+)$/;
const READING_API = /^\/api\/readings\/([^/]+)$/;

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
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
  try {
    return await route(pathname, request, env);
  } catch (error) {
    if (error instanceof ApiError) return error.response();
    console.error(error);
    return Response.json({ error: "internal", message: "unexpected server error" }, { status: 500 });
  }
}

function route(pathname: string, request: Request, env: Env): Promise<Response> | Response {
  const { method } = request;
  if (pathname === "/api/health" && method === "GET") return Response.json({ ok: true, engine: ENGINE_VERSION });
  if (pathname === "/api/readings" && method === "POST") return createReading(request, env);
  if (pathname === "/api/readers" && method === "GET") return readReaderRatings(env);
  const reading = READING_API.exec(pathname);
  if (reading?.[1] !== undefined && method === "GET") return readReading(reading[1], env);
  if (reading?.[1] !== undefined && method === "PATCH") return extendReading(reading[1], request, env);
  if (pathname === "/api/events" && method === "POST") return postEvent(request, env);
  throw new ApiError(404, "not_found", `no route ${method} ${pathname}`);
}
