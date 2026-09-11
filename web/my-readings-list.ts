/**
 * The "my readings" button on the landing and the list under it: one row per reading this browser opened, with the
 * instrument, the hour of the anchor, the reader and whether the forecast has ripened; a click opens the reading.
 * A dot on the button says a ripe reading is still unchecked. Nothing shows while there is nothing to list.
 */
import { postEvent } from "./api";
import { required } from "./dom-lookup";
import { onLangChange, t } from "./i18n/index";
import { icons } from "./icons";
import { localDateTime } from "./local-time-format";
import { hoursToRipe, isRipe, hasUnchecked, markChecked, myReadingsNow, onMyReadingsChange } from "./my-readings";
import type { MyReading } from "./my-readings";
import type { Navigate } from "./router";

function rowMarkup(entry: MyReading, now: number): string {
  const ripe = isRipe(entry, now);
  const status = ripe ? t().mine.ripe : t().mine.ripensIn(hoursToRipe(entry, now));
  return `<li role="option" data-id="${entry.id}" class="${ripe ? "ripe" : ""}"><span class="ticker">${entry.asset}</span><span class="status">${status}</span><span class="when">${localDateTime(entry.anchor_ts)}</span><span class="who">${t().readerName(entry.reader)}</span></li>`;
}

/** Mounts into `root`; the returned function drops the document listeners when the landing unmounts. */
export function mountMyReadings(root: HTMLElement, navigate: Navigate): () => void {
  root.classList.add("mine");
  root.innerHTML = `<button class="mine-trigger" type="button" aria-haspopup="listbox" aria-expanded="false">${icons.history}</button><ul class="picker-list mine-list" role="listbox" hidden></ul>`;
  const trigger = required(root, ".mine-trigger", HTMLButtonElement);
  const list = required(root, ".mine-list", HTMLUListElement);

  const paint = (): void => {
    const now = Date.now();
    const entries = myReadingsNow();
    root.hidden = entries.length === 0;
    trigger.title = t().mine.button;
    trigger.setAttribute("aria-label", t().mine.button);
    trigger.classList.toggle("due", hasUnchecked(entries, now));
    list.innerHTML = entries.map((entry) => rowMarkup(entry, now)).join("");
  };
  const close = (): void => {
    list.hidden = true;
    trigger.setAttribute("aria-expanded", "false");
  };
  const open = (): void => {
    paint();
    list.hidden = false;
    trigger.setAttribute("aria-expanded", "true");
  };

  trigger.addEventListener("click", () => {
    if (list.hidden) open();
    else close();
  });
  list.addEventListener("click", (event) => {
    const item = event.target instanceof Element ? event.target.closest<HTMLElement>("[data-id]") : null;
    const entry = myReadingsNow().find((candidate) => candidate.id === item?.dataset.id);
    if (entry === undefined) return;
    close();
    if (isRipe(entry, Date.now())) {
      void markChecked(entry.id);
      postEvent({ type: "rechecked", asset: entry.asset, reading_id: entry.id });
    }
    navigate(`/r/${entry.id}`);
  });
  const outside = (event: MouseEvent): void => {
    if (!list.hidden && event.target instanceof Node && !root.contains(event.target)) close();
  };
  const escape = (event: KeyboardEvent): void => {
    if (event.key === "Escape") close();
  };
  document.addEventListener("click", outside);
  document.addEventListener("keydown", escape);
  const unsubscribe = [onMyReadingsChange(paint), onLangChange(paint)];
  paint();

  return () => {
    document.removeEventListener("click", outside);
    document.removeEventListener("keydown", escape);
    for (const off of unsubscribe) off();
  };
}
