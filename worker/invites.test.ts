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

async function bring(code: string, newcomer: string): Promise<Response> {
  return await callApi("/api/wallet/invited", as(newcomer, post({ code })), TON);
}

/** A gift written straight to the table: the daily cap needs five of them and they are not worth five round trips. */
async function gift(sender: string, newcomer: string): Promise<void> {
  const token = `ta${Math.random().toString(16).slice(2).padEnd(16, "0").slice(0, 16)}`;
  await env.DB.prepare(
    "INSERT INTO invoices (token, owner, mana, cents, method, coin, amount, min_amount, created_at, paid_at," +
      " ext_id, pack) VALUES (?1, ?2, ?3, 0, 'invite', NULL, '0', '0', ?4, ?4, ?5, '')",
  )
    .bind(token, sender, INVITE_MANA, Date.now(), newcomer)
    .run();
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
  it("pays the sender, never the newcomer, and only once for the same newcomer", async () => {
    const sender = await newOwner();
    const code = await codeOf(sender);
    const newcomer = await newOwner();
    expect((await bring(code, newcomer)).status).toBe(200);
    expect(await balanceOf(sender)).toBe(INVITE_MANA);
    expect(await balanceOf(newcomer)).toBe(0);

    expect((await bring(code, newcomer)).status).toBe(409);
    expect(await balanceOf(sender)).toBe(INVITE_MANA);
  });

  it("refuses an invite that brings its own sender back, and a code nobody sent", async () => {
    const owner = await newOwner();
    expect((await bring(await codeOf(owner), owner)).status).toBe(400);
    expect((await bring("0123456789abcdef", await newOwner())).status).toBe(404);
    expect(await balanceOf(owner)).toBe(0);
  });

  it("stops paying one sender after five in a day", async () => {
    const sender = await newOwner();
    for (let i = 0; i < 5; i++) await gift(sender, `web:${String(i)}${Math.random().toString(16).slice(2)}`);
    expect((await bring(await codeOf(sender), await newOwner())).status).toBe(429);
    expect(await balanceOf(sender)).toBe(5 * INVITE_MANA);
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
