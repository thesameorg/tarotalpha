import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { callApi, post, type Init } from "./call-api";
import { FIRST_BUY_BONUS } from "./packs";
import { INVITE_MANA } from "./wallet";

const TON = { TON_WALLET: "UQD__TEST__WALLET", TONAPI_KEY: "key" };
const STARS = { TELEGRAM_BOT_TOKEN: "bot:token", TELEGRAM_WEBHOOK_SECRET: "hush" };

async function newOwner(): Promise<string> {
  const { owner } = await (await callApi("/api/wallet", { method: "POST" })).json<{ owner: string }>();
  return owner;
}

function as(owner: string, init: Init = {}): Init {
  return { ...init, headers: { ...(init.headers as Record<string, string>), "X-Wallet": owner } };
}

async function balanceOf(owner: string): Promise<number> {
  return (await (await callApi("/api/wallet", as(owner), TON)).json<{ balance: number }>()).balance;
}

async function codeOf(owner: string): Promise<string> {
  return (await (await callApi("/api/wallet/invite", as(owner), TON)).json<{ code: string }>()).code;
}

/** A reading row, which is the only server-side trace that a newcomer reached the cards. */
async function opened(): Promise<string> {
  const alphabet = "23456789bcdfghjkmnpqrstvwxz";
  const id = Array.from({ length: 8 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
  await env.DB.prepare(
    "INSERT INTO readings (id, asset, timeframe, anchor_ts, source, reader, seed_nonce, steps, candles_snapshot," +
      " created_at, origin) VALUES (?1, 'BTCUSDT', '1H', ?2, 'binance', 'atr', 'nonceabcd', '[]', '[]', ?2, 'share')",
  )
    .bind(id, Date.now())
    .run();
  return id;
}

async function bring(code: string, newcomer: string, reading?: string): Promise<Response> {
  return await callApi("/api/wallet/invited", as(newcomer, post({ code, reading: reading ?? (await opened()) })), TON);
}

describe("the invite code", () => {
  it("names the sender without being their purse", async () => {
    const owner = await newOwner();
    const code = await codeOf(owner);
    expect(code).toMatch(/^[0-9a-f]{16}$/);
    // A link already handed out has to keep working, so the code never rotates.
    expect(await codeOf(owner)).toBe(code);
    // The purse token is a bearer: a link carrying it would hand the purse to everyone it was forwarded to.
    expect(owner).not.toContain(code);
  });
});

describe("what an invite pays", () => {
  it("pays both sides, and only once for the same newcomer", async () => {
    const sender = await newOwner();
    const code = await codeOf(sender);
    const newcomer = await newOwner();
    expect((await bring(code, newcomer)).status).toBe(200);
    expect(await balanceOf(sender)).toBe(INVITE_MANA);
    expect(await balanceOf(newcomer)).toBe(INVITE_MANA);

    // Neither half is paid twice: both rows are keyed by the newcomer, so the pair is refused together.
    expect((await bring(code, newcomer)).status).toBe(409);
    expect(await balanceOf(sender)).toBe(INVITE_MANA);
    expect(await balanceOf(newcomer)).toBe(INVITE_MANA);
  });

  it("pays for a day that was opened, not for a visit", async () => {
    const sender = await newOwner();
    const code = await codeOf(sender);
    // Mana lives in the browser and the Worker cannot see it, so what it is shown is the row a day leaves behind.
    expect((await bring(code, await newOwner(), "")).status).toBe(400);
    expect((await bring(code, await newOwner(), "zzzzzzzz")).status).toBe(400);
    expect(await balanceOf(sender)).toBe(0);
  });

  it("refuses an invite that brings its own sender back, and a code nobody sent", async () => {
    const owner = await newOwner();
    expect((await bring(await codeOf(owner), owner)).status).toBe(400);
    expect((await bring("0123456789abcdef", await newOwner())).status).toBe(404);
    expect(await balanceOf(owner)).toBe(0);
  });

  it("keeps paying however many one link brings: there is no daily cap", async () => {
    const sender = await newOwner();
    const code = await codeOf(sender);
    // Mana costs nothing and every gift already costs a written reading, so nothing here turns a newcomer away.
    for (let i = 0; i < 6; i++) expect((await bring(code, await newOwner())).status).toBe(200);
    expect(await balanceOf(sender)).toBe(6 * INVITE_MANA);
  });

  it("does not spend the first-purchase bonus on a gift", async () => {
    const sender = await newOwner();
    await bring(await codeOf(sender), await newOwner());
    expect(await balanceOf(sender)).toBe(INVITE_MANA);
    // Nobody paid for the gift, so the doubling is still waiting for the first offer real money settles.
    const token = `ta${Math.random().toString(16).slice(2).padEnd(16, "0").slice(0, 16)}`;
    await env.DB.prepare(
      "INSERT INTO invoices (token, owner, mana, cents, method, coin, amount, min_amount, created_at, pack)" +
        " VALUES (?1, ?2, 30, 499, 'stars', 'usdt', '1', '1', ?3, 'standard')",
    )
      .bind(token, sender, Date.now())
      .run();
    await callApi(
      "/api/tg/webhook",
      {
        ...post({
          message: { successful_payment: { invoice_payload: token, telegram_payment_charge_id: "gift-then" } },
        }),
        headers: { "content-type": "application/json", "X-Telegram-Bot-Api-Secret-Token": "hush" },
      },
      STARS,
    );
    expect(await balanceOf(sender)).toBe(INVITE_MANA + 30 * FIRST_BUY_BONUS);
  });
});
