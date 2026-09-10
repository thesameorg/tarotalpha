/**
 * The profile card of a reader: portrait, name, stars, a paragraph about her and the row of the other readers to
 * switch to. The stars and the paragraph are placeholders — no reading has been scored yet — and the link goes to
 * the English method page, where the formulas live. Markup is built here because it follows the chosen reader.
 */
import { isReaderId } from "../engine/readers";
import { icons } from "./icons";
import { READER_FACES, reader, readerAvatarUrl, readerFace, setReader, type ReaderFace } from "./reader-choice";

const STARS = 5;

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
        `<button class="other" type="button" data-reader-pick="${face.id}"><img src="${readerAvatarUrl(face.id)}" alt=""><span><b>${face.name}</b><i>${face.method}</i></span></button>`,
    )
    .join("");
  return `<div class="others"><div class="others-title">Ask someone else</div><div class="others-row">${options}</div></div>`;
}

function paint(): void {
  const face = readerFace(reader());
  byId("reader-card").innerHTML =
    `<button class="icon-btn modal-close" id="closeReader" type="button" title="Close" aria-label="Close">${icons.close}</button>` +
    `<div class="profile-top"><img class="profile-face" src="${readerAvatarUrl(face.id)}" alt=""><div><h2>${face.name}</h2><p class="profile-method">${face.method}</p>${starsMarkup(face.rating)}</div></div>` +
    `<p class="profile-blurb">${face.blurb}</p>` +
    `<a class="how-link" href="/how.html#reader-${face.id}" target="_blank" rel="noopener">How this reader works${icons.external}</a>` +
    othersMarkup(face);
}

export function openReaderProfile(): void {
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
    if (target?.closest("#closeReader") != null) {
      close();
      return;
    }
    const pick = target?.closest<HTMLElement>("[data-reader-pick]");
    if (pick !== null && pick !== undefined && isReaderId(pick.dataset.readerPick)) {
      setReader(pick.dataset.readerPick);
      close();
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && modal.classList.contains("on")) close();
  });
}
