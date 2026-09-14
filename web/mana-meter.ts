/**
 * The two pools in the header, side by side and never added together: a violet flask for the free tank, whose
 * liquid sinks as it empties, and a gold one for bought mana, which starts at zero and only a purchase fills.
 * Either one opens a panel explaining itself, because a number with no story is just a number.
 * Repaints on a spend, on a purchase, on a language switch and once a minute, since the free tank refills while
 * the page stays open. What the pools are and why one is on the server: docs/wallet.md
 */
import { onLangChange, t } from "./i18n/index";
import { localTime } from "./local-time-format";
import { fullAt, MANA_CAPACITY, manaLeft, onManaChange } from "./mana";
import { onPaidChange, paidLeft } from "./paid-mana";
import { openPaywall } from "./paywall-modal";

const TICK_MS = 60_000;
// The liquid's surface in the flask's own units: the bottom of the bowl when empty, the base of the neck when full.
const LIQUID_BOTTOM = 23;
const LIQUID_TOP = 7;
const GLASS = "M8 3.5H12V8.3A7.5 7.5 0 1 1 8 8.3Z";
// The gold flask has no capacity of its own, so its liquid is drawn against a tankful to keep the two comparable.
const PAID_SCALE = MANA_CAPACITY;
let meters = 0;

function flask(share: number, clipId: string): string {
  const level = Math.min(1, Math.max(0, share));
  const surface = LIQUID_BOTTOM - level * (LIQUID_BOTTOM - LIQUID_TOP);
  return `<svg viewBox="0 0 20 24" width="18" height="22" aria-hidden="true" focusable="false"><defs><clipPath id="${clipId}"><path d="${GLASS}"/></clipPath></defs><rect class="potion" x="0" y="${surface.toFixed(2)}" width="20" height="24" clip-path="url(#${clipId})"/><path class="glass" d="${GLASS}"/><path class="shine" d="M5.4 15.2a4.8 4.8 0 0 1 2.2-3.9"/><rect class="cork" x="7.3" y="1" width="5.4" height="3" rx="1"/></svg>`;
}

export function mountManaMeter(root: HTMLElement): () => void {
  return mount(root, {
    left: () => manaLeft(),
    share: () => manaLeft() / MANA_CAPACITY,
    label: () => `${t().mana}: ${String(manaLeft())} / ${String(MANA_CAPACITY)}`,
    subscribe: onManaChange,
    open: openFreePanel,
  });
}

export function mountPaidMeter(root: HTMLElement): () => void {
  root.classList.add("mana-paid");
  return mount(root, {
    left: () => paidLeft(),
    share: () => paidLeft() / PAID_SCALE,
    label: () => `${t().paid.title}: ${String(paidLeft())}`,
    subscribe: onPaidChange,
    open: openPaidPanel,
  });
}

interface Pool {
  left: () => number;
  share: () => number;
  label: () => string;
  subscribe: (listener: () => void) => () => void;
  open: () => void;
}

function mount(root: HTMLElement, pool: Pool): () => void {
  // The liquid is clipped by id, so a second meter on the page must not share it.
  const clipId = `mana-flask-${String(++meters)}`;
  root.classList.add("mana");
  root.setAttribute("role", "button");
  root.tabIndex = 0;
  const paint = (): void => {
    root.innerHTML = `${flask(pool.share(), clipId)}<span class="mana-count">${String(pool.left())}</span>`;
    root.title = pool.label();
    root.setAttribute("aria-label", pool.label());
  };
  const unsubscribePool = pool.subscribe(paint);
  const unsubscribeLang = onLangChange(paint);
  const timer = setInterval(paint, TICK_MS);
  root.addEventListener("click", pool.open);
  root.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      pool.open();
    }
  });
  paint();
  return () => {
    unsubscribePool();
    unsubscribeLang();
    clearInterval(timer);
  };
}

function openFreePanel(): void {
  const left = manaLeft();
  const full = left >= MANA_CAPACITY;
  panel(
    t().mana,
    `${String(left)} / ${String(MANA_CAPACITY)}`,
    full ? t().manaPanel.full : t().manaPanel.fullAt(localTime(fullAt())),
    t().manaPanel.refill,
    null,
  );
}

function openPaidPanel(): void {
  panel(t().paid.title, String(paidLeft()), t().paid.order, t().paid.what, t().paywall.buy);
}

/** One box for either pool: the count large, a line about when it changes, and the rule under both. */
function panel(title: string, count: string, when: string, rule: string, buy: string | null): void {
  const box = document.getElementById("mana-panel");
  if (box === null) return;
  const heading = document.getElementById("mana-panel-title");
  if (heading !== null) heading.textContent = title;
  setText("mana-panel-count", count);
  setText("mana-panel-when", when);
  setText("mana-panel-rule", rule);
  const button = document.getElementById("mana-panel-buy");
  if (button !== null) {
    button.hidden = buy === null;
    if (buy !== null) button.textContent = buy;
  }
  box.classList.add("on");
}

function setText(id: string, value: string): void {
  const el = document.getElementById(id);
  if (el !== null) el.textContent = value;
}

/** Wires the panel's own buttons once; the panel itself is filled fresh each time a flask is clicked. */
export function initManaPanel(): void {
  const box = document.getElementById("mana-panel");
  if (box === null) return;
  const close = (): void => {
    box.classList.remove("on");
  };
  document.getElementById("mana-panel-close")?.addEventListener("click", close);
  box.addEventListener("click", (event) => {
    if (event.target === box) close();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && box.classList.contains("on")) close();
  });
  document.getElementById("mana-panel-buy")?.addEventListener("click", () => {
    close();
    openPaywall();
  });
}
