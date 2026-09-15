/**
 * The profile card of a reader: portrait, name, stars, a paragraph about her and the row of every reader with her
 * stars. Clicking another one only previews her card; nothing changes until the choose button is pressed. The stars
 * come from the Worker and arrive after the card is already open, so opening repaints it. The paragraphs are still
 * placeholders. How the formulas work is one link on the page itself, not here.
 */
import { isReaderId, READER_IDS, type ReaderId } from "../engine/readers";
import { icons } from "./icons";
import { onLangChange, t } from "./i18n/index";
import type { ReaderStanding } from "./api";
import { loadReaderTable, readerStanding } from "./reader-rating";
import { reader, readerAvatarUrl, readerLocked, setReader } from "./reader-choice";
import { shortOf } from "./mana-purse";
import { openPaywall } from "./paywall-modal";
import { askOpinion, OPINION_COST, opinions, opinionsOpen } from "./second-opinion";
import { toast } from "./toast";

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

function starRow(standing: ReaderStanding): string {
  const stars = Array.from({ length: STARS }, (_, i) => starMarkup(standing.stars - i)).join("");
  return `<div class="stars" role="img" aria-label="${t().reader.rated(standing.stars, STARS)}">${stars}</div>`;
}

function starsMarkup(id: ReaderId): string {
  const standing = readerStanding(id);
  if (standing === null) return `<div class="profile-unscored">${t().reader.unscored}</div>`;
  const wins = Math.round(standing.wins * 100);
  return starRow(standing) + `<div class="profile-score">${t().reader.wins(wins)}</div>`;
}

/** Who is already on this reading, before anyone is clicked: the author wears her lock, everyone asked a dot of
 *  the colour her line wears on the chart. */
function seatMarkup(id: ReaderId): { state: string; title: string; mark: string } {
  if (id === reader()) {
    const mark = readerLocked() ? `<span class="other-mark">${icons.lock}</span>` : "";
    return { state: " mine", title: t().reader.current, mark };
  }
  if (opinions().includes(id)) {
    return {
      state: " asked",
      title: t().reader.asked,
      mark: `<span class="other-mark dot" style="--hue: var(--reader-${id})"></span>`,
    };
  }
  return { state: "", title: t().readerName(id), mark: "" };
}

/** Everyone, always in the same order and the same place: a row that reshuffles under the cursor is a trap. */
function othersMarkup(current: ReaderId): string {
  const options = READER_IDS.map((id) => {
    const standing = readerStanding(id);
    const stars = standing === null ? "" : starRow(standing);
    const { state, title, mark } = seatMarkup(id);
    const text = `<span class="other-text"><b>${t().readerName(id)}</b>${stars}</span>`;
    return `<button class="other${state}${id === current ? " shown" : ""}" type="button" title="${title}" data-reader-show="${id}"><img src="${readerAvatarUrl(id)}" alt="">${text}${mark}</button>`;
  }).join("");
  return `<div class="others"><div class="others-title">${t().reader.others}</div><div class="others-row">${options}</div></div>`;
}

// Once a day is open the forecast is hers to the end: another reader is no longer chosen, she is asked — the cards
// stay the author's, and what is bought is a second formula over them.
function chooseMarkup(id: ReaderId): string {
  if (id === reader()) return `<div class="profile-current">${t().reader.current}</div>`;
  if (!readerLocked()) {
    return `<button class="draw profile-choose" type="button" data-reader-pick="${id}">${t().reader.choose(t().readerName(id))}</button>`;
  }
  if (opinions().includes(id)) return `<div class="profile-current">${t().reader.asked}</div>`;
  if (!opinionsOpen()) return `<div class="profile-current">${t().reader.locked(t().readerName(reader()))}</div>`;
  const ask = `<button class="draw profile-ask" type="button" data-reader-ask="${id}">${t().reader.ask(t().readerName(id), OPINION_COST)}<span class="mana-glyph">${icons.mana}</span></button>`;
  // What the price buys stands beside the price: a reader is bought for the reading, never for a day.
  return `${ask}<p class="profile-note">${t().reader.askNote(OPINION_COST)}</p>`;
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

/** Opens on `show`, or on the reader of the open reading: the row hands in whoever was clicked there. */
export function openReaderProfile(show: ReaderId = reader()): void {
  shown = show;
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
      return;
    }
    const ask = target.closest<HTMLElement>("[data-reader-ask]");
    if (ask !== null && isReaderId(ask.dataset.readerAsk)) {
      const id = ask.dataset.readerAsk;
      // Short of the price: the same wall a day hits, rather than a button that quietly does nothing.
      if (shortOf(OPINION_COST)) {
        close();
        openPaywall();
        return;
      }
      ask.setAttribute("disabled", "");
      void askOpinion(id).then((done) => {
        if (done) close();
        else toast(t().share.failed);
        paint();
      });
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && modal.classList.contains("on")) close();
  });
}
