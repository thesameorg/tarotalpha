import { env } from "cloudflare:workers";
import { beforeAll, expect, it } from "vitest";
import { callApi } from "./call-api";

const ID = "bcdfghjk";
const ANCHOR = Date.UTC(2026, 8, 8, 10);
const SHELL =
  '<!doctype html><html lang="ru"><head><title>TarotAlpha</title><meta property="og:title" content="TarotAlpha" />' +
  '<meta property="og:description" content="Таро-терминал" /><meta property="og:url" content="/" /></head>' +
  "<body><div id=app></div></body></html>";

const ASSETS = { fetch: () => Promise.resolve(new Response(SHELL, { headers: { "content-type": "text/html" } })) };

async function page(path: string, headers: Record<string, string> = {}): Promise<string> {
  return (await callApi(path, { headers }, { ASSETS: ASSETS as unknown as Fetcher })).text();
}

beforeAll(async () => {
  await env.DB.prepare(
    "INSERT INTO readings (id, asset, anchor_ts, source, engine_version, steps, candles_snapshot, created_at)" +
      " VALUES (?1, 'ETHUSDT', ?2, 'bybit', 'v1', '[[[0,0],[1,0],[2,1]],[[3,0],[4,1],[5,0]]]', '[]', 0)",
  )
    .bind(ID, ANCHOR)
    .run();
});

it("writes the reading into the title and the og tags in the share link's language", async () => {
  const html = await page(`/r/${ID}?lang=ru`);
  expect(html).toContain('<html lang="ru">');
  expect(html).toContain(`<title>TarotAlpha · ETHUSDT · расклад ${ID}</title>`);
  expect(html).toContain(`<meta property="og:title" content="TarotAlpha · ETHUSDT · расклад ${ID}" />`);
  expect(html).toContain(
    '<meta property="og:description" content="Расклад на 2 дн. вперёд от 2026-09-08 10:00 UTC. Не является финансовой рекомендацией." />',
  );
  expect(html).toContain(`<meta property="og:url" content="https://tarotalpha.test/r/${ID}" />`);
});

it("knows all eleven languages by the link and by Accept-Language, and falls back to English", async () => {
  expect(await page(`/r/${ID}?lang=zh`)).toContain(`<title>TarotAlpha · ETHUSDT · 牌阵 ${ID}</title>`);
  expect(await page(`/r/${ID}?lang=tr`)).toContain(`<title>TarotAlpha · ETHUSDT · açılım ${ID}</title>`);
  const russian = await page(`/r/${ID}`, { "accept-language": "ru-RU,ru;q=0.9,en;q=0.8" });
  expect(russian).toContain(`<title>TarotAlpha · ETHUSDT · расклад ${ID}</title>`);
  const brazilian = await page(`/r/${ID}`, { "accept-language": "nl-NL,pt-BR;q=0.8,en;q=0.5" });
  expect(brazilian).toContain('<html lang="pt">');
  expect(brazilian).toContain(`<title>TarotAlpha · ETHUSDT · leitura ${ID}</title>`);
  const english = await page(`/r/${ID}`, { "accept-language": "nl-NL,nl;q=0.9" });
  expect(english).toContain('<html lang="en">');
  expect(english).toContain(`<title>TarotAlpha · ETHUSDT · reading ${ID}</title>`);
  expect(english).toContain(
    '<meta property="og:description" content="A 2-day reading from 2026-09-08 10:00 UTC. Not financial advice." />',
  );
});

it("serves the untouched shell for an unknown id", async () => {
  expect(await page("/r/zzzzzzzz")).toBe(SHELL);
  expect(await page("/r/not-an-id")).toBe(SHELL);
});
