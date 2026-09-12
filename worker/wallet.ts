/**
 * The purse. Free mana lives in the browser and nobody checks it; bought mana is here, because it costs money.
 * The balance is never stored — it is the sum of this owner's paid offers, which makes crediting one conditional
 * UPDATE that a replayed webhook or a double-tapped "check payment" cannot turn into two credits.
 * The rails end to end, the refusals and what was rejected: docs/wallet.md
 */
import { ApiError, readJsonBody } from "./json-api";
import { packById, PACKS, type Pack } from "./packs";
import { approvePreCheckout, paymentOf, preCheckoutOf, setWebhook, starsInvoiceLink, telegramUserId } from "./telegram";
import { findTransfer, tonClient } from "./ton";

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
// The rate that was quoted can drift before the buyer signs; two cents are cheaper to eat than to argue about.
const UNDERPAY_TOLERANCE = 0.98;

type Method = "ton" | "stars";

interface InvoiceRow {
  token: string;
  owner: string;
  mana: number;
  method: string;
  amount: string;
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
  const amount = method === "ton" ? pack.nano : pack.stars;
  await env.DB.prepare(
    "INSERT INTO invoices (token, owner, mana, method, amount, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
  )
    .bind(token, owner, pack.mana, method, String(amount), Date.now())
    .run();

  return Response.json(
    method === "ton"
      ? { token, method, address: env.TON_WALLET, amount_nano: String(pack.nano) }
      : { token, method, invoice_link: await starsLink(env, pack, token) },
  );
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
  const found = await findTransfer(tonClient(key), wallet, token);
  if (found === null) throw new ApiError(402, "not_found_yet", "no transfer with this comment yet");
  if (found.nano < Number(invoice.amount) * UNDERPAY_TOLERANCE) {
    throw new ApiError(402, "underpaid", "the transfer is smaller than the offer");
  }

  await markPaid(token, found.hash, env);
  return Response.json({ balance: await balanceOf(owner, env), mana: invoice.mana });
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
  if (payment !== null && TOKEN.test(payment.token)) await markPaid(payment.token, payment.chargeId, env);
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

/** Marks an offer paid, once. A second call with the same charge changes nothing and raises nothing. */
async function markPaid(token: string, extId: string, env: WalletEnv): Promise<void> {
  await env.DB.prepare("UPDATE invoices SET paid_at = ?1, ext_id = ?2 WHERE token = ?3 AND paid_at IS NULL")
    .bind(Date.now(), extId, token)
    .run()
    // The unique index refuses a charge that already paid another offer; that is the guard doing its job.
    .catch(() => undefined);
}

async function balanceOf(owner: string, env: WalletEnv): Promise<number> {
  const row = await env.DB.prepare(
    "SELECT COALESCE(SUM(mana), 0) AS mana FROM invoices WHERE owner = ?1 AND paid_at IS NOT NULL",
  )
    .bind(owner)
    .first<{ mana: number }>();
  return row?.mana ?? 0;
}

async function invoiceOf(token: string, env: WalletEnv): Promise<InvoiceRow | null> {
  return await env.DB.prepare("SELECT token, owner, mana, method, amount, paid_at FROM invoices WHERE token = ?1")
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
