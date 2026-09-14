/**
 * Everything the Worker says to Telegram and everything it believes from it. Signatures are checked by
 * `@telegram-apps/init-data-node/web` — the Web Crypto build, the only one that runs on this runtime. This module
 * knows nothing about the database: it verifies, it asks Bot API, and the payment side decides what that means.
 * The rail end to end, and the one-time setWebhook: docs/wallet.md
 */
import { parse, validate } from "@telegram-apps/init-data-node/web";
import type { Pack } from "./packs";

const API = "https://api.telegram.org";
// Telegram cancels a payment whose pre-checkout goes unanswered for ten seconds, so the reply must not wait on us.
const PRE_CHECKOUT_MS = 8000;

export interface StarsPayment {
  /** The invoice token we put in `invoice_payload` when the link was made. */
  token: string;
  /** Telegram's own id for the charge; a refund needs it, and it is what keeps a replayed webhook from paying twice. */
  chargeId: string;
}

/** The user id behind a Mini App launch, or null when the signature, the freshness or the user is not there. */
export async function telegramUserId(initData: string, botToken: string): Promise<number | null> {
  try {
    await validate(initData, botToken);
    return parse(initData).user?.id ?? null;
  } catch {
    // A forged, stale or malformed launch: the caller answers as if no Telegram user were there at all.
    return null;
  }
}

/** A Stars invoice for one pack. `token` rides along as the payload and comes back with the payment. */
export async function starsInvoiceLink(botToken: string, pack: Pack, token: string, title: string): Promise<string> {
  const link: unknown = await callBot(botToken, "createInvoiceLink", {
    title,
    description: `${String(pack.mana)} mana`,
    payload: token,
    // Digital goods are sold for Stars with no provider: the currency is XTR and the price is whole stars.
    currency: "XTR",
    prices: [{ label: `${String(pack.mana)} mana`, amount: pack.stars }],
  });
  if (typeof link !== "string") throw new Error("createInvoiceLink returned no link");
  return link;
}

/** Points the bot's webhook at `origin`. Run by hand after a deploy to a new address; repeating it is harmless. */
export async function setWebhook(botToken: string, origin: string, secret: string): Promise<void> {
  await callBot(botToken, "setWebhook", {
    url: `${origin}/api/tg/webhook`,
    secret_token: secret,
    // Anything else Telegram might send is noise we would have to refuse anyway.
    allowed_updates: ["pre_checkout_query", "message"],
  });
}

/** Lets a payment through. Never rejects: a pre-checkout we fail to answer cancels the charge anyway. */
export async function approvePreCheckout(botToken: string, queryId: string): Promise<void> {
  await Promise.race([
    callBot(botToken, "answerPreCheckoutQuery", { pre_checkout_query_id: queryId, ok: true }),
    new Promise((resolve) => setTimeout(resolve, PRE_CHECKOUT_MS)),
  ]).catch(() => undefined);
}

/** The pre-checkout query id in an update, if that is what this update is. */
export function preCheckoutOf(update: Record<string, unknown>): string | null {
  const query = update.pre_checkout_query;
  if (typeof query !== "object" || query === null) return null;
  const { id } = query as Record<string, unknown>;
  return typeof id === "string" ? id : null;
}

/** The completed Stars payment in an update, if that is what this update is. */
export function paymentOf(update: Record<string, unknown>): StarsPayment | null {
  const message = update.message;
  if (typeof message !== "object" || message === null) return null;
  const payment = (message as Record<string, unknown>).successful_payment;
  if (typeof payment !== "object" || payment === null) return null;
  const { invoice_payload: token, telegram_payment_charge_id: chargeId } = payment as Record<string, unknown>;
  if (typeof token !== "string" || typeof chargeId !== "string") return null;
  return { token, chargeId };
}

async function callBot(botToken: string, method: string, body: unknown): Promise<unknown> {
  const response = await fetch(`${API}/bot${botToken}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload: { ok?: boolean; result?: unknown; description?: string } = await response.json();
  if (payload.ok !== true) throw new Error(`${method}: ${payload.description ?? String(response.status)}`);
  return payload.result;
}
