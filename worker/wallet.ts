/**
 * The purse. Free mana lives in the browser and nobody checks it; bought mana is here, because it costs money.
 * The balance is never stored — it is the sum of this owner's paid offers, which makes crediting one conditional
 * UPDATE that a replayed webhook or a double-tapped "check payment" cannot turn into two credits.
 * The rails end to end, the refusals and what was rejected: docs/wallet.md
 */
import { ApiError, readJsonBody } from "./json-api";
import { coinById, COINS, type Coin } from "./coins";
import { packById, PACKS, type Pack } from "./packs";
import { approvePreCheckout, paymentOf, preCheckoutOf, setWebhook, starsInvoiceLink, telegramUserId } from "./telegram";
import { findPayment, jettonWalletOf, quote, tonClient } from "./ton";

/** Secrets the payment side needs. All optional: a rail without its secret is simply not offered. */
export interface PaymentSecrets {
  TON_WALLET?: string;
  TONAPI_KEY?: string;
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_WEBHOOK_SECRET?: string;
}

export type WalletEnv = Env & PaymentSecrets;

const WEB_OWNER = /^web:[0-9a-f]{32}$/;
const TOKEN = /^ta[0-9a-f]{16}$/;
// The rate drifts between the quote and the signature, and a wallet rounds. Settling a little short beats telling
// someone who already paid that they are three cents out; the slack is written into the offer, not recomputed later.
const SLACK_CENTS = 3n;
// Three cents of a two-cent pack would be a negative floor, so the slack is whichever is smaller: three cents or
// three percent. Real prices get the flat three cents, test prices get the percentage.
const SLACK_PERCENT = 3n;

type Method = "ton" | "stars";

interface InvoiceRow {
  token: string;
  owner: string;
  mana: number;
  method: string;
  coin: string | null;
  min_amount: string;
  paid_at: number | null;
}

/** A fresh browser purse. The token is the whole credential: whoever holds it owns what it bought. */
export function newWallet(): Response {
  return Response.json({ owner: `web:${hex(16)}` });
}

/** The balance, the shelf and which rails this deployment can actually take money on. */
export async function readWallet(request: Request, env: WalletEnv): Promise<Response> {
  const owner = await ownerOf(request, env);
  return Response.json({
    balance: await balanceOf(owner, env),
    packs: PACKS,
    coins: COINS.map(({ id, symbol, decimals }) => ({ id, symbol, decimals })),
    rails: rails(env),
  });
}

/** Issues an offer and hands back what the buyer's rail needs to pay it. */
export async function createInvoice(request: Request, env: WalletEnv): Promise<Response> {
  const body = await readJsonBody(request);
  const owner = await ownerOf(request, env);
  const pack = packById(body.pack);
  if (pack === null) throw new ApiError(400, "bad_request", "pack is not on the shelf");
  const method = body.method === "ton" || body.method === "stars" ? body.method : null;
  if (method === null) throw new ApiError(400, "bad_request", "method must be ton or stars");
  if (!rails(env)[method]) throw new ApiError(503, "rail_off", `${method} is not configured`);

  const token = `ta${hex(8)}`;
  const coin = method === "ton" ? pickCoin(body.coin) : null;
  const { amount, min } = await priceOf(pack, method, coin, env);
  await env.DB.prepare(
    "INSERT INTO invoices (token, owner, mana, cents, method, coin, amount, min_amount, created_at)" +
      " VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
  )
    .bind(token, owner, pack.mana, pack.cents, method, coin?.id ?? null, String(amount), String(min), Date.now())
    .run();

  if (coin === null) return Response.json({ token, method, invoice_link: await starsLink(env, pack, token) });
  return Response.json({
    token,
    method,
    coin: coin.id,
    symbol: coin.symbol,
    decimals: coin.decimals,
    // A jetton is sent to its own master, not straight to us; the client needs both to build the transfer.
    address: env.TON_WALLET,
    master: coin.masterLink,
    amount: String(amount),
    comment: token,
  });
}

/** What this offer asks for and the least it settles for, both in the rail's own smallest unit. */
async function priceOf(
  pack: Pack,
  method: Method,
  coin: Coin | null,
  env: WalletEnv,
): Promise<{ amount: bigint; min: bigint }> {
  if (coin === null) return { amount: BigInt(pack.stars), min: BigInt(pack.stars) };
  const key = env.TONAPI_KEY;
  if (key === undefined) throw new ApiError(503, "rail_off", "ton is not configured");
  const amount = await quote(tonClient(key), coin, pack.cents);
  // Scaled from the asked amount rather than quoted twice: one rate for one offer, and no second call to drift.
  const flat = (amount * SLACK_CENTS) / BigInt(pack.cents);
  const share = (amount * SLACK_PERCENT) / 100n;
  return { amount, min: amount - (flat < share ? flat : share) };
}

function pickCoin(id: unknown): Coin {
  const coin = coinById(id);
  if (coin === null) throw new ApiError(400, "bad_request", "coin is not one this rail takes");
  return coin;
}

/** Where the buyer's own jetton wallet is, which only the chain knows and only a keyed client may ask. */
export async function readJettonWallet(request: Request, env: WalletEnv): Promise<Response> {
  const body = await readJsonBody(request);
  await ownerOf(request, env);
  const coin = coinById(body.coin);
  if (coin?.master === undefined || coin.master === null) {
    throw new ApiError(400, "bad_request", "that coin has no jetton wallet");
  }
  const from = typeof body.from === "string" ? body.from : null;
  if (from === null) throw new ApiError(400, "bad_request", "from must be the buyer's address");
  const key = env.TONAPI_KEY;
  if (key === undefined) throw new ApiError(503, "rail_off", "ton is not configured");
  const wallet = await jettonWalletOf(tonClient(key), from, coin.master);
  if (wallet === null) throw new ApiError(404, "no_jetton", "this address has never held that coin");
  return Response.json({ wallet });
}

/** Asks the chain whether a TON offer has been paid, and credits it if so. Stars never come through here. */
export async function claimInvoice(request: Request, env: WalletEnv): Promise<Response> {
  const body = await readJsonBody(request);
  const owner = await ownerOf(request, env);
  const token = typeof body.token === "string" && TOKEN.test(body.token) ? body.token : null;
  if (token === null) throw new ApiError(400, "bad_request", "token must match ^ta[0-9a-f]{16}$");

  const invoice = await invoiceOf(token, env);
  if (invoice === null || invoice.owner !== owner) throw new ApiError(404, "no_invoice", "no such offer");
  if (invoice.paid_at !== null) {
    throw new ApiError(409, "already_paid", "this offer is already paid", { balance: await balanceOf(owner, env) });
  }
  if (invoice.method !== "ton") throw new ApiError(400, "bad_request", "only a TON offer is claimed by hand");

  const { TON_WALLET: wallet, TONAPI_KEY: key } = env;
  if (wallet === undefined || key === undefined) throw new ApiError(503, "rail_off", "ton is not configured");
  const coin = coinById(invoice.coin);
  if (coin === null) throw new ApiError(400, "bad_request", "this offer names a coin the rail no longer takes");
  const found = await findPayment(tonClient(key), wallet, token, coin);
  if (found === null) throw new ApiError(402, "not_found_yet", "no payment with this comment yet");
  if (found.units < BigInt(invoice.min_amount)) {
    throw new ApiError(402, "underpaid", "the payment is smaller than the offer allows");
  }

  await markPaid(token, found.hash, "ton", env);
  return Response.json({ balance: await balanceOf(owner, env), mana: invoice.mana });
}

/** Spends bought mana — only what the free tank could not cover. Check and write are one statement, so two tabs
 * cannot spend the same mana twice. */
export async function spendMana(request: Request, env: WalletEnv): Promise<Response> {
  const body = await readJsonBody(request);
  const owner = await ownerOf(request, env);
  const mana = typeof body.mana === "number" && Number.isInteger(body.mana) && body.mana > 0 ? body.mana : null;
  if (mana === null) throw new ApiError(400, "bad_request", "mana must be a positive whole number");

  const written = await env.DB.prepare(
    "INSERT INTO spends (owner, mana, ts) SELECT ?1, ?2, ?3 WHERE" +
      " (SELECT COALESCE(SUM(mana), 0) FROM invoices WHERE owner = ?1 AND paid_at IS NOT NULL)" +
      " - (SELECT COALESCE(SUM(mana), 0) FROM spends WHERE owner = ?1) >= ?2",
  )
    .bind(owner, mana, Date.now())
    .run();
  if (written.meta.changes !== 1) {
    throw new ApiError(402, "short", "not enough bought mana", { balance: await balanceOf(owner, env) });
  }
  return Response.json({ balance: await balanceOf(owner, env) });
}

/** Telegram's side of the Stars rail. Pre-checkout has ten seconds to be answered or the charge is cancelled, and
 * only `successful_payment` credits — Telegram documents pre-checkout as no guarantee at all. */
export async function telegramWebhook(request: Request, env: WalletEnv): Promise<Response> {
  const secret = env.TELEGRAM_WEBHOOK_SECRET;
  const botToken = env.TELEGRAM_BOT_TOKEN;
  if (secret === undefined || botToken === undefined) throw new ApiError(503, "rail_off", "stars is not configured");
  if (request.headers.get("X-Telegram-Bot-Api-Secret-Token") !== secret) {
    throw new ApiError(401, "bad_owner", "webhook secret does not match");
  }
  const update = await readJsonBody(request);

  const preCheckout = preCheckoutOf(update);
  if (preCheckout !== null) {
    await approvePreCheckout(botToken, preCheckout);
    return Response.json({ ok: true });
  }

  const payment = paymentOf(update);
  if (payment !== null && TOKEN.test(payment.token)) await markPaid(payment.token, payment.chargeId, "stars", env);
  return Response.json({ ok: true });
}

/** Registers the bot's webhook on this deployment's own address, using the bot token the Worker already holds, so
 * the token never has to be carried anywhere by hand. Guarded by the same secret the webhook itself is signed with. */
export async function registerWebhook(request: Request, env: WalletEnv): Promise<Response> {
  const secret = env.TELEGRAM_WEBHOOK_SECRET;
  const botToken = env.TELEGRAM_BOT_TOKEN;
  if (secret === undefined || botToken === undefined) throw new ApiError(503, "rail_off", "stars is not configured");
  if (request.headers.get("X-Telegram-Bot-Api-Secret-Token") !== secret) {
    throw new ApiError(401, "bad_owner", "webhook secret does not match");
  }
  const { origin } = new URL(request.url);
  await setWebhook(botToken, origin, secret);
  return Response.json({ ok: true, webhook: `${origin}/api/tg/webhook` });
}

/** Settles one offer with one charge. A charge that already paid an offer is done and says so quietly; anything
 * else that goes wrong is left to throw, so the caller answers non-2xx and Telegram brings the payment back. */
async function markPaid(token: string, extId: string, method: Method, env: WalletEnv): Promise<void> {
  const settled = await env.DB.prepare("SELECT token FROM invoices WHERE method = ?1 AND ext_id = ?2")
    .bind(method, extId)
    .first<{ token: string }>();
  if (settled !== null) return;
  // Racing this SELECT breaks the unique index instead, which throws, and the retry finds the charge above.
  await env.DB.prepare(
    "UPDATE invoices SET paid_at = ?1, ext_id = ?2 WHERE token = ?3 AND method = ?4 AND paid_at IS NULL",
  )
    .bind(Date.now(), extId, token, method)
    .run();
}

/** Bought minus spent. Both halves are append-only sums, so no request can leave a half-written number behind. */
async function balanceOf(owner: string, env: WalletEnv): Promise<number> {
  const row = await env.DB.prepare(
    "SELECT (SELECT COALESCE(SUM(mana), 0) FROM invoices WHERE owner = ?1 AND paid_at IS NOT NULL)" +
      " - (SELECT COALESCE(SUM(mana), 0) FROM spends WHERE owner = ?1) AS mana",
  )
    .bind(owner)
    .first<{ mana: number }>();
  return row?.mana ?? 0;
}

async function invoiceOf(token: string, env: WalletEnv): Promise<InvoiceRow | null> {
  return await env.DB.prepare(
    "SELECT token, owner, mana, method, coin, min_amount, paid_at FROM invoices WHERE token = ?1",
  )
    .bind(token)
    .first<InvoiceRow>();
}

async function starsLink(env: WalletEnv, pack: Pack, token: string): Promise<string> {
  const botToken = env.TELEGRAM_BOT_TOKEN;
  if (botToken === undefined) throw new ApiError(503, "rail_off", "stars is not configured");
  return await starsInvoiceLink(botToken, pack, token, "TarotAlpha");
}

function rails(env: WalletEnv): Record<Method, boolean> {
  return {
    ton: env.TON_WALLET !== undefined && env.TONAPI_KEY !== undefined,
    stars: env.TELEGRAM_BOT_TOKEN !== undefined,
  };
}

/** Who is asking: a verified Telegram user when the launch data is there, otherwise the browser's own token. */
async function ownerOf(request: Request, env: WalletEnv): Promise<string> {
  const initData = request.headers.get("X-Telegram-Init-Data");
  if (initData !== null && initData !== "") {
    const botToken = env.TELEGRAM_BOT_TOKEN;
    if (botToken === undefined) throw new ApiError(503, "rail_off", "telegram is not configured");
    const id = await telegramUserId(initData, botToken);
    if (id === null) throw new ApiError(401, "bad_owner", "launch data did not verify");
    return `tg:${String(id)}`;
  }
  const web = request.headers.get("X-Wallet");
  if (web === null || !WEB_OWNER.test(web)) throw new ApiError(401, "bad_owner", "wallet token missing or malformed");
  return web;
}

function hex(bytes: number): string {
  return [...crypto.getRandomValues(new Uint8Array(bytes))].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
