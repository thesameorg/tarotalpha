import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { callApi, post, type Init } from "./call-api";
import { PACKS } from "./packs";

const TON = { TON_WALLET: "UQD__TEST__WALLET", TONAPI_KEY: "key" };
const STARS = { TELEGRAM_BOT_TOKEN: "bot:token", TELEGRAM_WEBHOOK_SECRET: "hush" };
const PACK = PACKS.find((pack) => pack.id === "mid");
if (PACK === undefined) throw new Error("the mid pack is gone from the shelf");

/** A browser purse, straight from the route that issues one. */
async function newOwner(): Promise<string> {
  const { owner } = await (await callApi("/api/wallet", { method: "POST" })).json<{ owner: string }>();
  return owner;
}

function as(owner: string, init: Init = {}): Init {
  return { ...init, headers: { ...(init.headers as Record<string, string>), "X-Wallet": owner } };
}

async function balanceOf(owner: string): Promise<number> {
  const response = await callApi("/api/wallet", as(owner), TON);
  return (await response.json<{ balance: number }>()).balance;
}

/** An offer written straight to the table: the webhook tests need one without asking Telegram for a link. */
async function offer(owner: string, method: string, mana = 30): Promise<string> {
  const token = `ta${Math.random().toString(16).slice(2).padEnd(16, "0").slice(0, 16)}`;
  await env.DB.prepare(
    "INSERT INTO invoices (token, owner, mana, method, amount, created_at) VALUES (?1, ?2, ?3, ?4, '1', ?5)",
  )
    .bind(token, owner, mana, method, Date.now())
    .run();
  return token;
}

function starsPaid(token: string, chargeId: string): Init {
  return {
    ...post({ message: { successful_payment: { invoice_payload: token, telegram_payment_charge_id: chargeId } } }),
    headers: { "content-type": "application/json", "X-Telegram-Bot-Api-Secret-Token": "hush" },
  };
}

describe("who is asking", () => {
  it("issues a purse token nobody could have guessed", async () => {
    const owner = await newOwner();
    expect(owner).toMatch(/^web:[0-9a-f]{32}$/);
    expect(await newOwner()).not.toBe(owner);
  });

  it("refuses a request with no purse and one with a malformed purse", async () => {
    expect((await callApi("/api/wallet", {}, TON)).status).toBe(401);
    expect((await callApi("/api/wallet", as("web:nonsense"), TON)).status).toBe(401);
  });

  it("starts a fresh purse empty", async () => {
    expect(await balanceOf(await newOwner())).toBe(0);
  });
});

describe("the shelf", () => {
  it("offers no rail the deployment has no secret for", async () => {
    const owner = await newOwner();
    const response = await callApi("/api/wallet", as(owner));
    expect(await response.json()).toMatchObject({ rails: { ton: false, stars: false } });
    const refused = await callApi("/api/wallet/invoice", as(owner, post({ pack: PACK.id, method: "ton" })));
    expect(refused.status).toBe(503);
    expect(await refused.json()).toMatchObject({ error: "rail_off" });
  });

  it("writes an offer and hands back what the wallet needs to pay it", async () => {
    const owner = await newOwner();
    const response = await callApi("/api/wallet/invoice", as(owner, post({ pack: PACK.id, method: "ton" })), TON);
    expect(response.status).toBe(200);
    const body = await response.json<{ token: string; address: string; amount_nano: string }>();
    expect(body.token).toMatch(/^ta[0-9a-f]{16}$/);
    expect(body.address).toBe(TON.TON_WALLET);
    expect(body.amount_nano).toBe(String(PACK.nano));
  });

  it("refuses a pack nobody sells and a rail that does not exist", async () => {
    const owner = await newOwner();
    const pack = await callApi("/api/wallet/invoice", as(owner, post({ pack: "free", method: "ton" })), TON);
    expect(pack.status).toBe(400);
    const rail = await callApi("/api/wallet/invoice", as(owner, post({ pack: PACK.id, method: "barter" })), TON);
    expect(rail.status).toBe(400);
  });
});

describe("crediting", () => {
  it("counts the balance as the mana of paid offers only", async () => {
    const owner = await newOwner();
    await offer(owner, "stars", 30);
    expect(await balanceOf(owner)).toBe(0);
    const paid = await offer(owner, "stars", 30);
    await callApi("/api/tg/webhook", starsPaid(paid, "charge-counted"), STARS);
    expect(await balanceOf(owner)).toBe(30);
  });

  it("takes a repeated webhook for the same offer without flinching", async () => {
    const owner = await newOwner();
    const token = await offer(owner, "stars", 70);
    for (let i = 0; i < 4; i++) {
      expect((await callApi("/api/tg/webhook", starsPaid(token, "charge-repeated"), STARS)).status).toBe(200);
    }
    expect(await balanceOf(owner)).toBe(70);
  });

  it("lets one charge pay one offer and no more, even across two offers", async () => {
    const owner = await newOwner();
    const first = await offer(owner, "stars", 30);
    const second = await offer(owner, "stars", 70);
    expect((await callApi("/api/tg/webhook", starsPaid(first, "charge-once"), STARS)).status).toBe(200);
    // Answering 200 is the point: a 500 here would have Telegram redelivering this charge for good.
    expect((await callApi("/api/tg/webhook", starsPaid(second, "charge-once"), STARS)).status).toBe(200);
    expect(await balanceOf(owner)).toBe(30);
  });

  it("never lets a charge from one rail settle an offer issued for the other", async () => {
    const owner = await newOwner();
    const tonOffer = await offer(owner, "ton", 30);
    await callApi("/api/tg/webhook", starsPaid(tonOffer, "charge-wrong-rail"), STARS);
    expect(await balanceOf(owner)).toBe(0);
  });

  it("keeps one purse out of another's money", async () => {
    const mine = await newOwner();
    const yours = await newOwner();
    const token = await offer(yours, "stars", 30);
    await callApi("/api/tg/webhook", starsPaid(token, "charge-not-mine"), STARS);
    expect(await balanceOf(yours)).toBe(30);
    expect(await balanceOf(mine)).toBe(0);
  });
});

describe("the Stars webhook", () => {
  it("does not read an update that is not signed with our secret", async () => {
    const owner = await newOwner();
    const token = await offer(owner, "stars", 30);
    const unsigned = { ...post({ message: {} }), headers: { "content-type": "application/json" } };
    expect((await callApi("/api/tg/webhook", unsigned, STARS)).status).toBe(401);
    const wrong = { ...starsPaid(token, "charge-forged"), headers: { "X-Telegram-Bot-Api-Secret-Token": "guess" } };
    expect((await callApi("/api/tg/webhook", wrong, STARS)).status).toBe(401);
    expect(await balanceOf(owner)).toBe(0);
  });

  it("says nothing at all when the rail has no secrets", async () => {
    expect((await callApi("/api/tg/webhook", starsPaid("ta0000000000000000", "x"))).status).toBe(503);
  });
});

describe("claiming a TON offer", () => {
  it("refuses a token that is not ours, or is nobody's", async () => {
    const mine = await newOwner();
    const yours = await newOwner();
    const token = await offer(yours, "ton");
    const stolen = await callApi("/api/wallet/claim", as(mine, post({ token })), TON);
    expect(stolen.status).toBe(404);
    const unknown = await callApi("/api/wallet/claim", as(mine, post({ token: "ta0123456789abcdef" })), TON);
    expect(unknown.status).toBe(404);
  });

  it("refuses a malformed token before it ever asks the chain", async () => {
    const owner = await newOwner();
    const response = await callApi("/api/wallet/claim", as(owner, post({ token: "../etc" })), TON);
    expect(response.status).toBe(400);
  });

  it("tells a paid offer apart from an unpaid one and hands back the balance", async () => {
    const owner = await newOwner();
    const token = await offer(owner, "stars", 30);
    await callApi("/api/tg/webhook", starsPaid(token, "charge-already"), STARS);
    const response = await callApi("/api/wallet/claim", as(owner, post({ token })), TON);
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ error: "already_paid", balance: 30 });
  });
});
