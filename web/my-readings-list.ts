/**
 * "My readings" in the header: a labelled button with the count, a dot on it while a ripe reading is unchecked, and
 * the window it opens, one card per reading this browser opened — instrument, reader, hour of the anchor and whether
 * the forecast has ripened; a ripe unchecked one is lit. A click opens the reading. The button hides while there is
 * nothing to list. Closes on the corner cross, a click outside or Escape.
 */
import { postEvent } from "./api";
import { COINS } from "./coin-list";
import { required } from "./dom-lookup";
import { onLangChange, t } from "./i18n/index";
import { icons, setIcon } from "./icons";
import { localDateTime } from "./local-time-format";
import { hoursToRipe, isRipe, hasUnchecked, markChecked, myReadingsNow, onMyReadingsChange } from "./my-readings";
import type { MyReading } from "./my-readings";
import { readerAvatarUrl } from "./reader-choice";
import type { Navigate } from "./router";

function cardMarkup(entry: MyReading, now: number): string {
  const ripe = isRipe(entry, now);
  const due = ripe && entry.checked_at === null;
  const status = ripe ? t().mine.ripe : t().mine.ripensIn(hoursToRipe(entry, now));
  const icon = COINS.find((coin) => coin.symbol === entry.asset)?.icon;
  const coin = icon === undefined ? "" : `<img src="${icon}" width="18" height="18" alt="">`;
  return `<li><button type="button" class="mine-card${ripe ? " ripe" : ""}${due ? " due" : ""}" data-id="${entry.id}">
<span class="mine-coin">${coin}${entry.asset}</span><span class="mine-status">${status}</span>
<span class="mine-reader"><img src="${readerAvatarUrl(entry.reader)}" alt="">${t().readerName(entry.reader)}</span><span class="mine-when">${localDateTime(entry.anchor_ts)}</span></button></li>`;
}

export function mountMyReadings(root: HTMLElement, navigate: Navigate): void {
  const modal = required(document, "#my-readings", HTMLElement);
  const cards = required(modal, ".mine-cards", HTMLUListElement);
  const corner = required(modal, "#closeMine", HTMLButtonElement);
  root.classList.add("mine");
  root.innerHTML = `<button class="mine-trigger" type="button" aria-haspopup="dialog">${icons.history}<span class="mine-label"></span><span class="mine-count"></span></button>`;
  const trigger = required(root, ".mine-trigger", HTMLButtonElement);
  const label = required(trigger, ".mine-label", HTMLElement);
  const count = required(trigger, ".mine-count", HTMLElement);

  const paint = (): void => {
    const now = Date.now();
    const entries = myReadingsNow();
    root.hidden = entries.length === 0;
    label.textContent = t().mine.button;
    count.textContent = String(entries.length);
    trigger.title = t().mine.button;
    trigger.setAttribute("aria-label", `${t().mine.button}: ${String(entries.length)}`);
    trigger.classList.toggle("due", hasUnchecked(entries, now));
    setIcon(corner, icons.close, t().close);
    if (modal.classList.contains("on")) cards.innerHTML = entries.map((entry) => cardMarkup(entry, now)).join("");
  };
  const close = (): void => {
    modal.classList.remove("on");
  };

  trigger.addEventListener("click", () => {
    modal.classList.add("on");
    paint();
  });
  corner.addEventListener("click", close);
  modal.addEventListener("click", (event) => {
    if (event.target === modal) {
      close();
      return;
    }
    const card = event.target instanceof Element ? event.target.closest<HTMLElement>("[data-id]") : null;
    const entry = myReadingsNow().find((candidate) => candidate.id === card?.dataset.id);
    if (entry === undefined) return;
    close();
    if (isRipe(entry, Date.now())) {
      void markChecked(entry.id);
      postEvent({ type: "rechecked", asset: entry.asset, reading_id: entry.id });
    }
    navigate(`/r/${entry.id}`);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && modal.classList.contains("on")) close();
  });
  onMyReadingsChange(paint);
  onLangChange(paint);
  paint();
}
