/**
 * The profile card of a reader: portrait, name, stars, a paragraph about her and the row of the other readers.
 * Clicking another one only previews her card; nothing changes until the choose button is pressed. The stars and
 * the paragraphs are placeholders — no reading has been scored yet. How the formulas work is one link on the page
 * itself, not here. Markup is built here because it follows whoever is being shown.
 */
import { isReaderId, type ReaderId } from "../engine/readers";
import { icons } from "./icons";
import { READER_FACES, reader, readerAvatarUrl, readerFace, setReader, type ReaderFace } from "./reader-choice";

const STARS = 5;

let shown: ReaderId = reader();

function byId(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (el === null) throw new Error(`reader profile: #${id} is missing`);
  return el;
}

function starsMarkup(rating: number): string {
  const stars = Array.from(
    { length: STARS },
    (_, i) => `<span class="star${i < rating ? " on" : ""}">${icons.star}</span>`,
  ).join("");
  // No number next to the stars: it would read as a measured score, and nothing has been measured yet.
  return `<div class="stars" role="img" aria-label="rated ${String(rating)} of ${String(STARS)}">${stars}</div>`;
}

function othersMarkup(current: ReaderFace): string {
  const options = READER_FACES.filter((face) => face.id !== current.id)
    .map(
      (face) =>
        `<button class="other${face.id === reader() ? " mine" : ""}" type="button" data-reader-show="${face.id}"><img src="${readerAvatarUrl(face.id)}" alt=""><span><b>${face.name}</b><i>${face.method}</i></span></button>`,
    )
    .join("");
  return `<div class="others"><div class="others-title">Ask someone else</div><div class="others-row">${options}</div></div>`;
}

function chooseMarkup(face: ReaderFace): string {
  if (face.id === reader()) return `<div class="profile-current">Reading your candles now</div>`;
  return `<button class="draw profile-choose" type="button" data-reader-pick="${face.id}">Let ${face.name} read</button>`;
}

function paint(): void {
  const face = readerFace(shown);
  byId("reader-card").innerHTML =
    `<button class="icon-btn modal-close" id="closeReader" type="button" title="Close" aria-label="Close">${icons.close}</button>` +
    `<div class="profile-top"><img class="profile-face" src="${readerAvatarUrl(face.id)}" alt=""><div><h2>${face.name}</h2><p class="profile-method">${face.method}</p>${starsMarkup(face.rating)}</div></div>` +
    `<p class="profile-blurb">${face.blurb}</p>` +
    chooseMarkup(face) +
    othersMarkup(face);
}

export function openReaderProfile(): void {
  shown = reader();
  paint();
  byId("reader-profile").classList.add("on");
}

export function initReaderProfile(): void {
  const modal = byId("reader-profile");
  const close = (): void => {
    modal.classList.remove("on");
  };
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
