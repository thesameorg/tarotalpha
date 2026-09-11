/**
 * The profile card of a reader: portrait, name, stars, a paragraph about her and the row of the other readers.
 * Clicking another one only previews her card; nothing changes until the choose button is pressed. The stars come
 * from the Worker and arrive after the card is already open, so opening repaints it. The paragraphs are still
 * placeholders. How the formulas work is one link on the page itself, not here.
 */
import { isReaderId, READER_IDS, type ReaderId } from "../engine/readers";
import { icons } from "./icons";
import { onLangChange, t } from "./i18n/index";
import { loadReaderTable, readerStanding } from "./reader-rating";
import { reader, readerAvatarUrl, setReader } from "./reader-choice";

const STARS = 5;

let shown: ReaderId = reader();

function byId(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (el === null) throw new Error(`reader profile: #${id} is missing`);
  return el;
}

// Halves are drawn, not rounded away: a gold copy of the star sits over the dim one, clipped to its left half.
function starMarkup(filled: number): string {
  if (filled >= 1) return `<span class="star on">${icons.star}</span>`;
  if (filled < 0.5) return `<span class="star">${icons.star}</span>`;
  return `<span class="star half">${icons.star}<span class="star-lit">${icons.star}</span></span>`;
}

function starsMarkup(id: ReaderId): string {
  const standing = readerStanding(id);
  if (standing === null) return `<div class="profile-unscored">${t().reader.unscored}</div>`;
  const stars = Array.from({ length: STARS }, (_, i) => starMarkup(standing.stars - i)).join("");
  const wins = Math.round(standing.wins * 100);
  return (
    `<div class="stars" role="img" aria-label="${t().reader.rated(standing.stars, STARS)}">${stars}</div>` +
    `<div class="profile-score">${t().reader.wins(wins)}</div>`
  );
}

/** Everyone, always in the same order and the same place: a row that reshuffles under the cursor is a trap. */
function othersMarkup(current: ReaderId): string {
  const options = READER_IDS.map(
    (id) =>
      `<button class="other${id === current ? " shown" : ""}" type="button" data-reader-show="${id}"><img src="${readerAvatarUrl(id)}" alt=""><span>${t().readerName(id)}</span></button>`,
  ).join("");
  return `<div class="others"><div class="others-title">${t().reader.others}</div><div class="others-row">${options}</div></div>`;
}

function chooseMarkup(id: ReaderId): string {
  if (id === reader()) return `<div class="profile-current">${t().reader.current}</div>`;
  return `<button class="draw profile-choose" type="button" data-reader-pick="${id}">${t().reader.choose(t().readerName(id))}</button>`;
}

function paint(): void {
  const close = t().close;
  byId("reader-card").innerHTML =
    `<button class="icon-btn modal-close" id="closeReader" type="button" title="${close}" aria-label="${close}">${icons.close}</button>` +
    `<div class="profile-top"><img class="profile-face" src="${readerAvatarUrl(shown)}" alt=""><div><h2>${t().readerName(shown)}</h2>${starsMarkup(shown)}</div></div>` +
    `<p class="profile-blurb">${t().readerBlurb(shown)}</p>` +
    chooseMarkup(shown) +
    othersMarkup(shown);
}

export function openReaderProfile(): void {
  shown = reader();
  paint();
  byId("reader-profile").classList.add("on");
  void loadReaderTable().then(paint);
}

export function initReaderProfile(): void {
  const modal = byId("reader-profile");
  const close = (): void => {
    modal.classList.remove("on");
  };
  onLangChange(() => {
    if (modal.classList.contains("on")) paint();
  });
  modal.addEventListener("click", (event) => {
    if (event.target === modal) {
      close();
      return;
    }
    const target = event.target instanceof Element ? event.target : null;
    if (target === null) return;
    if (target.closest("#closeReader") !== null) {
      close();
      return;
    }
    const preview = target.closest<HTMLElement>("[data-reader-show]");
    if (preview !== null && isReaderId(preview.dataset.readerShow)) {
      shown = preview.dataset.readerShow;
      paint();
      return;
    }
    const pick = target.closest<HTMLElement>("[data-reader-pick]");
    if (pick !== null && isReaderId(pick.dataset.readerPick)) {
      setReader(pick.dataset.readerPick);
      close();
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && modal.classList.contains("on")) close();
  });
}
