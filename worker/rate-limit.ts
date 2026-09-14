/**
 * 60 requests a minute per client address on every `/api/*` route, counted by the Workers Rate Limiting binding
 * (`ratelimits` in wrangler.jsonc). The binding counts per Cloudflare location, not globally, which is enough to keep
 * one scraper from spending the D1 write budget. Miniflare implements the same binding, so `vite dev` and the tests
 * answer with real 429s. Not KV: a counter there would cost a write per request and a paid tier per busy day.
 */
const PERIOD_S = 60;

export function clientIp(request: Request): string {
  return request.headers.get("cf-connecting-ip") ?? "local";
}

/** `null` when the request may proceed, otherwise the 429 to send back. */
export async function rateLimited(limiter: RateLimit, request: Request): Promise<Response | null> {
  const { success } = await limiter.limit({ key: clientIp(request) });
  if (success) return null;
  return Response.json(
    { error: "rate_limited", message: "too many requests from one address, try again in a minute" },
    { status: 429, headers: { "Retry-After": String(PERIOD_S) } },
  );
}
