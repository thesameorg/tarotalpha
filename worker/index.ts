/** One Worker: `/api/*` is answered here, `/r/<id>` is index.html with the reading's meta tags, the rest is static. */
import { postEvent, statsToday } from "./events";
import { ApiError } from "./json-api";
import { rateLimited } from "./rate-limit";
import { readingPage } from "./reading-page";
import { createReading, readReading } from "./readings";

const READING_PAGE = /^\/r\/([^/]+)$/;
const READING_API = /^\/api\/readings\/([^/]+)$/;

export default {
  async fetch(request, env, ctx) {
    const { pathname } = new URL(request.url);
    if (pathname.startsWith("/api/")) return api(pathname, request, env, ctx);
    const page = READING_PAGE.exec(pathname);
    if (page?.[1] !== undefined) return readingPage(page[1], request, env);
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;

async function api(pathname: string, request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const limited = await rateLimited(env.RATE_LIMITER, request);
  if (limited !== null) return limited;
  try {
    return await route(pathname, request, env, ctx);
  } catch (error) {
    if (error instanceof ApiError) return error.response();
    console.error(error);
    return Response.json({ error: "internal", message: "unexpected server error" }, { status: 500 });
  }
}

function route(pathname: string, request: Request, env: Env, ctx: ExecutionContext): Promise<Response> | Response {
  const { method } = request;
  if (pathname === "/api/health" && method === "GET") return Response.json({ ok: true, engine: env.ENGINE_VERSION });
  if (pathname === "/api/readings" && method === "POST") return createReading(request, env);
  const reading = READING_API.exec(pathname);
  if (reading?.[1] !== undefined && method === "GET") return readReading(reading[1], request, env, ctx);
  if (pathname === "/api/stats/today" && method === "GET") return statsToday(env);
  if (pathname === "/api/events" && method === "POST") return postEvent(request, env);
  throw new ApiError(404, "not_found", `no route ${method} ${pathname}`);
}
