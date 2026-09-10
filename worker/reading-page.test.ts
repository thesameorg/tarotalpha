import { env } from "cloudflare:workers";
import { beforeAll, expect, it } from "vitest";
import { callApi } from "./call-api";

const ID = "bcdfghjk";
const ANCHOR = Date.UTC(2026, 8, 8, 10);
const SHELL =
  '<!doctype html><html><head><title>TarotAlpha</title><meta property="og:title" content="TarotAlpha" />' +
  '<meta property="og:description" content="Таро-терминал" /><meta property="og:url" content="/" /></head>' +
  "<body><div id=app></div></body></html>";

const ASSETS = { fetch: () => Promise.resolve(new Response(SHELL, { headers: { "content-type": "text/html" } })) };

async function page(id: string): Promise<string> {
  return (await callApi(`/r/${id}`, {}, { ASSETS: ASSETS as unknown as Fetcher })).text();
}

beforeAll(async () => {
  await env.DB.prepare(
    "INSERT INTO readings (id, asset, anchor_ts, source, engine_version, steps, candles_snapshot, created_at)" +
      " VALUES (?1, 'ETHUSDT', ?2, 'bybit', 'v1', '[[[0,0],[1,0],[2,1]],[[3,0],[4,1],[5,0]]]', '[]', 0)",
  )
    .bind(ID, ANCHOR)
    .run();
});

it("writes the reading into the title and the og tags", async () => {
  const html = await page(ID);
  expect(html).toContain(`<title>TarotAlpha · ETHUSDT · расклад ${ID}</title>`);
  expect(html).toContain(`<meta property="og:title" content="TarotAlpha · ETHUSDT · расклад ${ID}" />`);
  expect(html).toContain(
    '<meta property="og:description" content="Расклад на 2 дн. вперёд от 2026-09-08 10:00 UTC. Не является финансовой рекомендацией." />',
  );
  expect(html).toContain(`<meta property="og:url" content="https://tarotalpha.test/r/${ID}" />`);
});

it("serves the untouched shell for an unknown id", async () => {
  expect(await page("zzzzzzzz")).toBe(SHELL);
  expect(await page("not-an-id")).toBe(SHELL);
});
