/**
 * The mana left, a glyph and a number beside the step marks of the landing, with the full count as its label.
 * Repaints on a spend, on a language switch and once a minute, since the tank refills while the page stays open.
 */
import { onLangChange, t } from "./i18n/index";
import { icons } from "./icons";
import { MANA_CAPACITY, manaLeft, onManaChange } from "./mana";

const TICK_MS = 60_000;

export function mountManaMeter(root: HTMLElement): () => void {
  root.classList.add("mana");
  root.setAttribute("role", "img");
  const paint = (): void => {
    const left = manaLeft();
    const label = `${t().mana}: ${String(left)} / ${String(MANA_CAPACITY)}`;
    root.innerHTML = `<span class="mana-glyph">${icons.bolt}</span>${String(left)}`;
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
