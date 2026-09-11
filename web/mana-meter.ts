/**
 * The mana left in the header, the way games show it: a potion flask whose liquid sinks as the tank empties, and
 * the count beside it. Repaints on a spend, on a language switch and once a minute, since the tank refills while the
 * page stays open.
 */
import { onLangChange, t } from "./i18n/index";
import { MANA_CAPACITY, manaLeft, onManaChange } from "./mana";

const TICK_MS = 60_000;
// The liquid's surface in the flask's own units: the bottom of the bowl when empty, the base of the neck when full.
const LIQUID_BOTTOM = 23;
const LIQUID_TOP = 7;
const GLASS = "M8 3.5H12V8.3A7.5 7.5 0 1 1 8 8.3Z";

function flask(left: number): string {
  const share = Math.min(1, Math.max(0, left / MANA_CAPACITY));
  const surface = LIQUID_BOTTOM - share * (LIQUID_BOTTOM - LIQUID_TOP);
  return `<svg viewBox="0 0 20 24" width="18" height="22" aria-hidden="true" focusable="false"><defs><clipPath id="mana-flask"><path d="${GLASS}"/></clipPath></defs><rect class="potion" x="0" y="${surface.toFixed(2)}" width="20" height="24" clip-path="url(#mana-flask)"/><path class="glass" d="${GLASS}"/><path class="shine" d="M5.4 15.2a4.8 4.8 0 0 1 2.2-3.9"/><rect class="cork" x="7.3" y="1" width="5.4" height="3" rx="1"/></svg>`;
}

export function mountManaMeter(root: HTMLElement): () => void {
  root.classList.add("mana");
  root.setAttribute("role", "img");
  const paint = (): void => {
    const left = manaLeft();
    const label = `${t().mana}: ${String(left)} / ${String(MANA_CAPACITY)}`;
    root.innerHTML = `${flask(left)}<span class="mana-count">${String(left)}</span>`;
    root.title = label;
    root.setAttribute("aria-label", label);
  };
  const unsubscribeMana = onManaChange(paint);
  const unsubscribeLang = onLangChange(paint);
  const timer = setInterval(paint, TICK_MS);
  paint();
  return () => {
    unsubscribeMana();
    unsubscribeLang();
    clearInterval(timer);
  };
}
