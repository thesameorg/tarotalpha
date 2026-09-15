/**
 * The paywall: opens when the tank is short of the next day's mana. Three steps in one box — pick a pack, pick a
 * coin, pay — and inside Telegram only the first, because there the purchase is one tap on a Stars invoice and a
 * coin picker would be a detour. Stars exist nowhere else: they are a Telegram product and cannot be bought from a
 * browser at all. Prices come from the Worker and are never computed here. Rails end to end: docs/wallet.md
 */
import { postEvent } from "./api";
import { applyStatic, onLangChange, t } from "./i18n/index";
import { icons, setIcon } from "./icons";
import { ENDLESS_SIGN, refreshPaid } from "./paid-mana";
import { telegram } from "./telegram";
import { toast } from "./toast";
import {
  claim,
  humanAmount,
  offerChain,
  offerStars,
  shelf,
  shortAmount,
  walletLink,
  type ChainOffer,
  type Shelf,
} from "./wallet";

// How often we ask the chain whether the payment landed. TON settles in about a second; the wait is indexing.
const POLL_MS = 4000;
const POLL_LIMIT = 150;
// Telegram's sheet closes before our webhook runs, so the balance is waited on for a short while after it does.
const STARS_WAIT_MS = 1200;
const STARS_TRIES = 20;

type Step = "packs" | "coins" | "invoice" | "done";

let loaded: Shelf | null = null;
let chosen: string | null = null;
let offered: ChainOffer | null = null;
let polling: number | null = null;

export function openPaywall(): void {
  postEvent({ type: "paywall_shown" });
  modal().classList.add("on");
  show("packs");
  void fill();
}

export function initPaywallModal(): void {
  const el = modal();
  const close = (): void => {
    el.classList.remove("on");
    stopPolling();
  };
  const corner = document.getElementById("closePayCorner");
  if (corner !== null) {
    const label = (): void => {
      setIcon(corner, icons.close, t().close);
    };
    label();
    onLangChange(label);
    corner.addEventListener("click", close);
  }
  document.getElementById("closePay")?.addEventListener("click", close);
  document.getElementById("pay-done-go")?.addEventListener("click", close);
  el.addEventListener("click", (event) => {
    if (event.target === el) close();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && el.classList.contains("on")) close();
  });

  copyButton("pay-copy-exact", "pay-exact");
  copyButton("pay-copy-address", "pay-address");
  copyButton("pay-copy-comment", "pay-comment");
  document.getElementById("pay-go")?.addEventListener("click", () => {
    const current = offered;
    if (current === null) return;
    // The wallet signs, the chain settles, and the poll already running is what notices. Refusing to sign is not
    // an error worth shouting about: the offer stays open and the fields below still work.
    void import("./ton-pay")
      .then(async ({ payWithWallet }) => {
        await payWithWallet(current);
      })
      .catch((error: unknown) => {
        // A wallet the buyer closed is not worth a word; anything else must say something, because a button that
        // fails in silence reads as a broken button, and the QR beside it would go untried.
        if (!refused(error)) toast(t().paywall.failed);
      });
  });
  onLangChange(() => {
    if (loaded !== null) paintPacks(loaded);
  });
}

/** The shelf, asked once per opening: the balance moves, and a stale price is worse than a short wait. */
async function fill(): Promise<void> {
  const packs = document.getElementById("mana-packs");
  if (packs === null) return;
  try {
    loaded = await shelf();
    paintPacks(loaded);
  } catch {
    packs.innerHTML = `<p class="pay-warn">${t().paywall.failed}</p>`;
  }
}

function paintPacks(shelfNow: Shelf): void {
  const list = document.getElementById("mana-packs");
  if (list === null) return;
  const stars = inTelegram();
  list.innerHTML = shelfNow.packs
    .map(
      (pack) =>
        `<div class="tier${pack.unlimited === true ? " tier-endless" : ""}">` +
        `<div class="t"><span class="mana-glyph">${icons.mana}</span>` +
        `${pack.unlimited === true ? ENDLESS_SIGN : String(pack.mana)}</div>` +
        `<div class="pay-price">${stars ? `${String(pack.stars)} ★` : price(pack.cents)}</div>` +
        `<button type="button" data-pack="${pack.id}" data-i18n="paywall.buy"></button></div>`,
    )
    .join("");
  applyStatic(list);
  for (const button of list.querySelectorAll<HTMLButtonElement>("button[data-pack]")) {
    button.addEventListener("click", () => {
      const pack = button.dataset.pack;
      if (pack === undefined) return;
      chosen = pack;
      postEvent({ type: "buy_clicked", detail: pack });
      if (stars) void payWithStars(pack);
      else paintCoins(shelfNow);
    });
  }
}

function paintCoins(shelfNow: Shelf): void {
  const list = document.getElementById("pay-coin-list");
  if (list === null) return;
  list.innerHTML = shelfNow.coins
    .map((coin) => {
      // Gram was Toncoin until June 2026 and nobody recognises the new name yet; the old one rides along.
      const was = coin.id === "gram" ? `<small>${t().paywall.wasTon}</small>` : "";
      return `<button class="coin" type="button" data-coin="${coin.id}">${coin.symbol}${was}</button>`;
    })
    .join("");
  for (const button of list.querySelectorAll<HTMLButtonElement>("button[data-coin]")) {
    button.addEventListener("click", () => {
      const coin = button.dataset.coin;
      if (coin !== undefined && chosen !== null) void payWithCoin(chosen, coin);
    });
  }
  show("coins");
}

async function payWithCoin(pack: string, coin: string): Promise<void> {
  // TON Connect and the cell builder are a third of the bundle and only a buyer needs them, so the landing never
  // loads them; the fetch starts here, a screen before the button that uses it, and is warm by the time it is.
  void import("./ton-pay");
  try {
    const offer = await offerChain(pack, coin);
    paintInvoice(offer);
    show("invoice");
    startPolling(offer.token);
  } catch {
    toast(t().paywall.failed);
  }
}

function paintInvoice(offer: ChainOffer): void {
  offered = offer;
  text("pay-amount", shortAmount(offer.amount, offer.decimals));
  text("pay-symbol", offer.symbol);
  field("pay-exact", `${humanAmount(offer.amount, offer.decimals)} ${offer.symbol}`);
  field("pay-address", offer.address);
  field("pay-comment", offer.comment);
  const link = walletLink(offer);
  const open = document.getElementById("pay-open");
  if (open instanceof HTMLAnchorElement) open.href = link;
  void paintQr(link);
}

/** The same link as the button, as a square a phone can read: the page is on a desktop, the wallet is not. */
async function paintQr(link: string): Promise<void> {
  const img = document.getElementById("pay-qr");
  const box = document.getElementById("pay-qr-box");
  if (!(img instanceof HTMLImageElement) || box === null) return;
  try {
    const { toDataURL } = await import("qrcode");
    img.src = await toDataURL(link, { margin: 1, width: 400, errorCorrectionLevel: "M" });
    box.hidden = false;
  } catch {
    // No square, no loss: the button and the three copyable fields are both still there.
    box.hidden = true;
  }
}

/** Telegram bills Stars itself; the webhook credits, so all this waits for is the client saying the sheet closed. */
async function payWithStars(pack: string): Promise<void> {
  const app = telegram();
  if (app === null) return;
  try {
    const { invoice_link: link } = await offerStars(pack);
    app.openInvoice(link, (status) => {
      if (status !== "paid") return;
      void settle();
    });
  } catch {
    toast(t().paywall.failed);
  }
}

/** Telegram closes its sheet the moment the buyer pays, usually before our webhook has run, so the balance is
 * waited for: read once, it catches the old number and announces a purchase of nothing. */
async function settle(): Promise<void> {
  const before = loaded?.balance ?? 0;
  const endless = boughtEndless();
  for (let left = STARS_TRIES; left > 0; left--) {
    try {
      const now = await shelf();
      loaded = now;
      // An endless lot credits no mana, so a balance that has not moved proves nothing: the right is what lands.
      if (endless ? now.unlimited : now.balance > before) {
        done(now.balance, now.balance - before, endless);
        return;
      }
    } catch {
      // The network blinked mid-wait; the webhook is still coming, so keep asking.
    }
    await sleep(STARS_WAIT_MS);
  }
  // Paid but still not credited: the webhook will land, and the flask reads the server rather than this screen.
  void refreshPaid();
  toast(t().paywall.slow);
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function startPolling(token: string): void {
  stopPolling();
  // What the purse held before this offer: the difference is what the buyer just gained, and that is the number
  // worth showing large. The balance alone would read the same whether they bought ten or already had ten.
  const before = loaded?.balance ?? 0;
  const endless = boughtEndless();
  let left = POLL_LIMIT;
  polling = window.setInterval(() => {
    left -= 1;
    if (left <= 0) {
      stopPolling();
      return;
    }
    void claim(token)
      .then((balance) => {
        if (balance === null) return;
        stopPolling();
        done(balance, balance - before, endless);
      })
      .catch(() => {
        // A refusal we cannot act on: keep waiting rather than tearing the screen down under a paying customer.
      });
  }, POLL_MS);
}

function stopPolling(): void {
  if (polling !== null) window.clearInterval(polling);
  polling = null;
}

/** Whether the lot the buyer just picked sells an endless purse rather than a number of mana. */
function boughtEndless(): boolean {
  return loaded?.packs.find((pack) => pack.id === chosen)?.unlimited === true;
}

function done(balance: number, gained: number, endless: boolean): void {
  stopPolling();
  // Where both rails meet: the Worker learns a star payment from Telegram's own request, which carries neither this
  // visit nor this buyer's country, so the purchase is reported from here. What was actually paid lives in D1.
  postEvent({ type: "paid", detail: chosen ?? undefined, cost: endless ? undefined : gained });
  // The gold flask in the header reads the server, not this screen, so it is told the moment the money lands.
  void refreshPaid();
  text("pay-gain", endless ? ENDLESS_SIGN : `+${String(gained)}`);
  text("pay-ok", endless ? t().paywall.endless : t().paywall.credited(balance));
  show("done");
}

function show(step: Step): void {
  for (const id of ["packs", "coins", "invoice", "done"]) {
    const el = document.getElementById(`pay-${id}`);
    if (el !== null) el.hidden = id !== step;
  }
  // The lead explains how the free tank refills, which is the last thing a buyer mid-payment needs to read.
  const lead = document.getElementById("pay-lead");
  if (lead !== null) lead.hidden = step !== "packs";
  // The finished screen carries its own way out, and the same words twice under it read as two different doors.
  const back = document.getElementById("closePay");
  if (back !== null) back.hidden = step === "done";
}

function copyButton(buttonId: string, fieldId: string): void {
  const button = document.getElementById(buttonId);
  if (button === null) return;
  const label = (): void => {
    setIcon(button, icons.copy, t().share.copy);
  };
  label();
  onLangChange(label);
  button.addEventListener("click", () => {
    const input = document.getElementById(fieldId);
    if (!(input instanceof HTMLInputElement)) return;
    input.select();
    void navigator.clipboard
      .writeText(input.value)
      .then(() => {
        toast(t().share.copied);
      })
      .catch(() => {
        toast(t().share.selectToCopy);
      });
  });
}

/** TON Connect says "user rejected" in its own words; closing a wallet is a choice, not a failure to report. */
function refused(error: unknown): boolean {
  return error instanceof Error && /reject|cancel|abort|close/i.test(error.message);
}

const price = (cents: number): string => `$${(cents / 100).toFixed(2)}`;

const inTelegram = (): boolean => telegram() !== null;

function modal(): HTMLElement {
  const el = document.getElementById("paywall");
  if (el === null) throw new Error("paywall modal: #paywall is missing");
  return el;
}

function text(id: string, value: string): void {
  const el = document.getElementById(id);
  if (el !== null) el.textContent = value;
}

function field(id: string, value: string): void {
  const el = document.getElementById(id);
  if (el instanceof HTMLInputElement) el.value = value;
}
