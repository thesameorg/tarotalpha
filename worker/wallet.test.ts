import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { callApi, post, type Init } from "./call-api";
import { COINS } from "./coins";
import { PACKS } from "./packs";

const TON = { TON_WALLET: "UQD__TEST__WALLET", TONAPI_KEY: "key" };
const STARS = { TELEGRAM_BOT_TOKEN: "bot:token", TELEGRAM_WEBHOOK_SECRET: "hush" };
const PACK = PACKS.find((pack) => pack.id === "mid");
if (PACK === undefined) throw new Error("the mid pack is gone from the shelf");
const USDT = COINS.find((coin) => coin.id === "usdt");
if (USDT === undefined) throw new Error("the stablecoin is gone from the rail");

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
    "INSERT INTO invoices (token, owner, mana, cents, method, coin, amount, min_amount, created_at)" +
      " VALUES (?1, ?2, ?3, 499, ?4, 'usdt', '1', '1', ?5)",
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

  it("writes a stablecoin offer and hands back everything the wallet needs to pay it", async () => {
    const owner = await newOwner();
    const body = post({ pack: PACK.id, method: "ton", coin: "usdt" });
    const response = await callApi("/api/wallet/invoice", as(owner, body), TON);
    expect(response.status).toBe(200);
    const offer = await response.json<Record<string, string>>();
    expect(offer.token).toMatch(/^ta[0-9a-f]{16}$/);
    expect(offer.address).toBe(TON.TON_WALLET);
    expect(offer.master).toBe(USDT.master);
    expect(offer.symbol).toBe("USD₮");
    // The comment is the whole mechanism: it is what brings the payment back to this offer.
    expect(offer.comment).toBe(offer.token);
    // 499 cents at six decimals, no rate anywhere: a dollar coin is already the price.
    expect(offer.amount).toBe("4990000");
  });

  it("settles a payment a few cents short rather than arguing about it", async () => {
    const owner = await newOwner();
    const body = post({ pack: PACK.id, method: "ton", coin: "usdt" });
    const { token } = await (await callApi("/api/wallet/invoice", as(owner, body), TON)).json<{ token: string }>();
    const row = await env.DB.prepare("SELECT amount, min_amount FROM invoices WHERE token = ?1")
      .bind(token)
      .first<{ amount: string; min_amount: string }>();
    expect(row?.amount).toBe("4990000");
    // Three cents of slack, written into the offer so a claim never needs a rate.
    expect(row?.min_amount).toBe("4960000");
  });

  it("refuses a pack nobody sells, a rail that does not exist and a coin we do not take", async () => {
    const owner = await newOwner();
    const pack = post({ pack: "free", method: "ton", coin: "usdt" });
    expect((await callApi("/api/wallet/invoice", as(owner, pack), TON)).status).toBe(400);
    const rail = post({ pack: PACK.id, method: "barter" });
    expect((await callApi("/api/wallet/invoice", as(owner, rail), TON)).status).toBe(400);
    const coin = post({ pack: PACK.id, method: "ton", coin: "dogecoin" });
    expect((await callApi("/api/wallet/invoice", as(owner, coin), TON)).status).toBe(400);
    const none = post({ pack: PACK.id, method: "ton" });
    expect((await callApi("/api/wallet/invoice", as(owner, none), TON)).status).toBe(400);
  });

  it("pins the stablecoin by its master address, because a forgery can copy the ticker", () => {
    expect(USDT.master).toBe("0:b113a994b5024a16719f69139328eb759596c38a25f59028b146fecdc3621dfe");
    expect(USDT.decimals).toBe(6);
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
